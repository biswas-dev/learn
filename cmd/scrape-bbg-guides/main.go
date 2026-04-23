package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var (
	apiBase   = envOr("LEARN_API_URL", "http://localhost:8080")
	apiKey    = os.Getenv("LEARN_API_KEY")
	bbgCookie string
	imagesDir = envOr("LEARN_IMAGES_DIR", "data/images")
)

var categories = []struct {
	slug  string
	title string
}{
	{"software-development", "Software Development"},
	{"cloud-distributed-systems", "Cloud & Distributed Systems"},
	{"how-it-works", "How It Works?"},
	{"devops-cicd", "DevOps and CI/CD"},
	{"security", "Security"},
	{"computer-fundamentals", "Computer Fundamentals"},
	{"api-web-development", "API & Web Development"},
	{"database-and-storage", "Database & Storage"},
	{"software-architecture", "Software Architecture"},
	{"ai-machine-learning", "AI & Machine Learning"},
	{"caching-performance", "Caching & Performance"},
	{"payment-and-fintech", "Payment & Fintech"},
	{"real-world-case-studies", "Real World Case Studies"},
	{"technical-interviews", "Technical Interviews"},
	{"devtools-productivity", "DevTools & Productivity"},
}

type guide struct {
	slug     string
	title    string
	diagram  string // https://assets.bytebytego.com/diagrams/...
	content  string // HTML content
	category string
}

var (
	titleRe   = regexp.MustCompile(`<h1[^>]*>(.*?)</h1>`)
	diagramRe = regexp.MustCompile(`src="(https://assets\.bytebytego\.com/[^"]+)"`)
	paraRe    = regexp.MustCompile(`(?s)<p[^>]*>(.*?)</p>`)
	tagRe     = regexp.MustCompile(`<[^>]+>`)
	linkRe    = regexp.MustCompile(`href="/guides/([a-z0-9-]+)/"`)
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: "15:04:05"})

	if apiKey == "" {
		log.Fatal().Msg("LEARN_API_KEY is required")
	}

	bbgCookie = os.Getenv("BBG_COOKIE")
	if bbgCookie == "" {
		data, err := os.ReadFile(envOr("BBG_COOKIE_FILE", os.Getenv("HOME")+"/.config/go-bytebytego/cookie.txt"))
		if err != nil {
			log.Fatal().Msg("BBG_COOKIE required (run: python3 get-bbg-cookie.py --write)")
		}
		bbgCookie = strings.TrimSpace(string(data))
	}
	os.MkdirAll(imagesDir, 0755)

	// Filter to a single category if requested
	targetCat := os.Getenv("BBG_GUIDE_CATEGORY")

	seen := make(map[string]bool) // track guides already scraped (some appear in multiple categories)
	totalGuides := 0
	totalImages := 0

	for _, cat := range categories {
		if targetCat != "" && cat.slug != targetCat {
			continue
		}

		log.Info().Str("category", cat.title).Msg("fetching category")

		// Get all guide slugs in this category
		guideSlugs := fetchCategorySlugs(cat.slug)
		if len(guideSlugs) == 0 {
			log.Warn().Str("cat", cat.slug).Msg("no guides found")
			continue
		}

		// Filter out already-scraped guides
		var newSlugs []string
		for _, s := range guideSlugs {
			if !seen[s] {
				newSlugs = append(newSlugs, s)
				seen[s] = true
			}
		}

		log.Info().Int("guides", len(newSlugs)).Int("skipped", len(guideSlugs)-len(newSlugs)).Msg("guides to scrape")

		if len(newSlugs) == 0 {
			continue
		}

		// Create course for this category
		courseTitle := fmt.Sprintf("Visual Guides: %s — ByteByteGo", cat.title)
		courseSlug := "bbg-guides-" + cat.slug
		courseResp := learnPost("/api/courses", map[string]any{
			"title":        courseTitle,
			"description":  fmt.Sprintf("ByteByteGo visual guides on %s", cat.title),
			"slug":         courseSlug,
			"is_protected": true,
		})
		if courseResp["id"] == nil {
			// Course may already exist
			log.Error().Any("resp", courseResp).Str("slug", courseSlug).Msg("failed to create course, skipping category")
			continue
		}
		courseID := int64(courseResp["id"].(float64))
		log.Info().Int64("id", courseID).Str("slug", courseSlug).Msg("course created")

		// Tag with ByteByteGo source
		learnPost(fmt.Sprintf("/api/courses/%d/tags", courseID), map[string]any{
			"tags": []map[string]string{
				{"name": "ByteByteGo", "category": "Source"},
				{"name": cat.title, "category": guessTagCategory(cat.slug)},
			},
		})

		// Scrape each guide and create as a section+page
		for i, slug := range newSlugs {
			if i > 0 {
				delay := 500*time.Millisecond + time.Duration(rand.Int63n(int64(time.Second)))
				time.Sleep(delay)
			}

			g := fetchGuide(slug, cat.slug)
			if g == nil {
				continue
			}

			// Download the diagram image
			imgCount := 0
			if g.diagram != "" {
				localImg := downloadImage(g.diagram)
				if localImg != "" {
					g.content = strings.ReplaceAll(g.content, g.diagram, localImg)
					imgCount++
				}
			}

			// Create section + page
			secResp := learnPost(fmt.Sprintf("/api/courses/%d/sections", courseID), map[string]any{
				"title":      g.title,
				"sort_order": i,
			})
			if secResp["id"] == nil {
				log.Error().Str("title", g.title).Msg("failed to create section")
				continue
			}
			sectionID := int64(secResp["id"].(float64))

			learnPost(fmt.Sprintf("/api/sections/%d/pages", sectionID), map[string]any{
				"title":      g.title,
				"content":    g.content,
				"sort_order": 0,
			})

			totalGuides++
			totalImages += imgCount
			log.Info().
				Int("n", i+1).
				Int("total", len(newSlugs)).
				Str("title", g.title).
				Int("images", imgCount).
				Msg("uploaded guide")
		}

		// Publish course
		learnPost(fmt.Sprintf("/api/courses/%d/publish", courseID), nil)
		log.Info().Str("course", courseSlug).Msg("course published")
	}

	log.Info().
		Int("guides", totalGuides).
		Int("images", totalImages).
		Int("categories", len(categories)).
		Msg("all guides scraped")
}

func fetchCategorySlugs(catSlug string) []string {
	html := curlGet(fmt.Sprintf("https://bytebytego.com/guides/%s/", catSlug))
	if html == "" {
		return nil
	}

	matches := linkRe.FindAllStringSubmatch(html, -1)
	seen := make(map[string]bool)
	var slugs []string

	catSet := make(map[string]bool)
	for _, c := range categories {
		catSet[c.slug] = true
	}

	for _, m := range matches {
		slug := m[1]
		if slug == "_astro" || catSet[slug] || seen[slug] {
			continue
		}
		seen[slug] = true
		slugs = append(slugs, slug)
	}
	return slugs
}

func fetchGuide(slug, catSlug string) *guide {
	html := curlGet(fmt.Sprintf("https://bytebytego.com/guides/%s/", slug))
	if html == "" || len(html) < 1000 {
		log.Warn().Str("slug", slug).Msg("empty guide page")
		return nil
	}

	// Extract title
	title := slug
	if m := titleRe.FindStringSubmatch(html); len(m) > 1 {
		title = strings.TrimSpace(tagRe.ReplaceAllString(m[1], ""))
	}

	// Extract diagram image
	var diagram string
	if m := diagramRe.FindStringSubmatch(html); len(m) > 1 {
		diagram = m[1]
	}

	// Extract content paragraphs
	var contentParts []string
	paras := paraRe.FindAllStringSubmatch(html, -1)
	for _, p := range paras {
		text := strings.TrimSpace(p[1])
		clean := strings.TrimSpace(tagRe.ReplaceAllString(text, " "))
		// Skip navigation/boilerplate paragraphs
		if len(clean) < 20 || strings.Contains(clean, "Categories") || strings.Contains(clean, "cookie") ||
			strings.Contains(clean, "Share Download") || strings.Contains(clean, "Edit on GitHub") {
			continue
		}
		contentParts = append(contentParts, fmt.Sprintf("<p>%s</p>", text))
	}

	// Build HTML content: title + diagram + text
	var sb strings.Builder
	if diagram != "" {
		sb.WriteString(fmt.Sprintf(`<figure class="bbg-guide-diagram"><img src="%s" alt="%s" style="max-width:100%%" /></figure>`+"\n\n", diagram, title))
	}
	for _, p := range contentParts {
		sb.WriteString(p)
		sb.WriteString("\n\n")
	}

	return &guide{
		slug:     slug,
		title:    title,
		diagram:  diagram,
		content:  sb.String(),
		category: catSlug,
	}
}

func downloadImage(imgURL string) string {
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(imgURL)))[:12]
	ext := path.Ext(imgURL)
	if ext == "" || len(ext) > 5 {
		ext = ".png"
	}
	if idx := strings.Index(ext, "?"); idx != -1 {
		ext = ext[:idx]
	}
	filename := hash + ext
	localPath := filepath.Join(imagesDir, filename)

	if _, err := os.Stat(localPath); err == nil {
		return "/images/" + filename
	}

	cmd := exec.Command("curl", "-s", "-L", "-o", localPath, imgURL,
		"-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
		"-H", "Referer: https://bytebytego.com/",
	)
	if err := cmd.Run(); err != nil {
		log.Warn().Err(err).Str("url", imgURL).Msg("image download failed")
		return ""
	}

	info, err := os.Stat(localPath)
	if err != nil || info.Size() < 100 {
		os.Remove(localPath)
		return ""
	}

	return "/images/" + filename
}

func curlGet(url string) string {
	cmd := exec.Command("curl", "-s", "-L", url,
		"-H", "Cookie: "+bbgCookie,
		"-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
	)
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return string(out)
}

func learnPost(urlPath string, body map[string]any) map[string]any {
	var reqBody io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reqBody = bytes.NewReader(data)
	} else {
		reqBody = bytes.NewReader([]byte("{}"))
	}
	req, _ := http.NewRequest("POST", apiBase+urlPath, reqBody)
	req.Header.Set("Authorization", "ApiKey "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Fatal().Err(err).Str("path", urlPath).Msg("learn API error")
	}
	defer resp.Body.Close()
	var result map[string]any
	json.NewDecoder(resp.Body).Decode(&result)
	if resp.StatusCode >= 400 {
		log.Error().Int("status", resp.StatusCode).Str("path", urlPath).Any("response", result).Msg("learn API error")
	}
	return result
}

func guessTagCategory(catSlug string) string {
	switch catSlug {
	case "ai-machine-learning":
		return "AI/ML"
	case "database-and-storage":
		return "Databases"
	case "devops-cicd":
		return "DevOps/Cloud"
	case "security":
		return "Security"
	case "software-architecture", "software-development":
		return "System Design"
	case "cloud-distributed-systems":
		return "System Design"
	case "technical-interviews":
		return "Interviews"
	default:
		return "General"
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
