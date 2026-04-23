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
	buildID   string // Next.js build ID, discovered from first page fetch
)

type courseMetadata struct {
	Title          string `json:"title"`
	Authors        string `json:"authors"`
	Key            string `json:"key"`
	DefaultChapter string `json:"defaultChapter"`
	RootPath       string `json:"rootPath"`
	Lessons        int    `json:"lessons"`
	Students       int    `json:"students"`
	ShowChapter    bool   `json:"showChapter"`
}

type tocEntry struct {
	Course  string   `json:"course"`
	Slug    []string `json:"slug"`
	ID      string   `json:"id"`
	Chapter any      `json:"chapter"`
	Title   string   `json:"title"`
	Free    bool     `json:"free"`
}

type pageProps struct {
	Course         string         `json:"course"`
	ID             string         `json:"id"`
	Chapter        any            `json:"chapter"`
	Title          string         `json:"title"`
	Free           bool           `json:"free"`
	Code           string         `json:"code"`
	TOC            []tocEntry     `json:"toc"`
	CourseMetadata courseMetadata `json:"courseMetadata"`
}

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: "15:04:05"})

	if apiKey == "" {
		log.Fatal().Msg("LEARN_API_KEY is required")
	}

	// Load cookie
	bbgCookie = os.Getenv("BBG_COOKIE")
	if bbgCookie == "" {
		data, err := os.ReadFile(envOr("BBG_COOKIE_FILE", os.Getenv("HOME")+"/.config/go-bytebytego/cookie.txt"))
		if err != nil {
			log.Fatal().Msg("BBG_COOKIE is required (or run: python3 get-bbg-cookie.py --write)")
		}
		bbgCookie = strings.TrimSpace(string(data))
	}

	courseSlug := envOr("BBG_COURSE", "system-design-interview")
	imagesDir := envOr("LEARN_IMAGES_DIR", "data/images")
	os.MkdirAll(imagesDir, 0755)

	// Step 1: Fetch the first page to get TOC and course metadata
	log.Info().Str("course", courseSlug).Msg("fetching course structure")

	firstPageHTML := bbgFetchHTML("/courses/" + courseSlug)
	if firstPageHTML == "" {
		log.Fatal().Msg("failed to fetch course page — check cookie")
	}

	props := extractPageProps(firstPageHTML)
	if props == nil {
		log.Fatal().Msg("failed to extract page props from HTML")
	}

	meta := props.CourseMetadata
	log.Info().
		Str("title", meta.Title).
		Str("author", meta.Authors).
		Int("lessons", meta.Lessons).
		Msg("course found")

	if buildID == "" {
		log.Fatal().Msg("could not discover Next.js buildId")
	}

	toc := props.TOC
	log.Info().Int("chapters", len(toc)).Msg("table of contents loaded")

	// Step 2: Create course in learn
	slug := os.Getenv("BBG_LEARN_SLUG")
	if slug == "" {
		slug = courseSlug
	}
	createReq := map[string]any{
		"title":        meta.Title + " — ByteByteGo",
		"description":  meta.Authors,
		"is_protected": true,
	}
	if slug != "" {
		createReq["slug"] = slug
	}
	courseResp := learnPost("/api/courses", createReq)
	if courseResp["id"] == nil {
		log.Fatal().Any("response", courseResp).Msg("failed to create course")
	}
	courseID := int64(courseResp["id"].(float64))
	learnSlug, _ := courseResp["slug"].(string)
	log.Info().Int64("id", courseID).Str("slug", learnSlug).Msg("course created in learn")

	// Tag course with "bytebytego" source tag
	learnPost(fmt.Sprintf("/api/courses/%d/tags", courseID), map[string]any{
		"tags": []map[string]string{
			{"name": "ByteByteGo", "category": "Source"},
		},
	})
	log.Info().Msg("tagged course with bytebytego source")

	// Step 3: Fetch and upload each page
	totalPages := len(toc)
	for i, entry := range toc {
		log.Info().
			Int("page", i+1).
			Int("total", totalPages).
			Str("title", entry.Title).
			Msg("fetching page")

		// Rate limit: 1-3 second delay between requests
		if i > 0 {
			delay := time.Second + time.Duration(rand.Int63n(int64(2*time.Second)))
			time.Sleep(delay)
		}

		pageSlug := entry.ID
		if len(entry.Slug) > 0 {
			pageSlug = strings.Join(entry.Slug, "/")
		}

		content := fetchPageContent(courseSlug, pageSlug)
		if content == "" {
			log.Warn().Str("page", entry.Title).Msg("empty content, skipping")
			continue
		}

		// Download images and rewrite URLs
		content, imgCount := downloadAndRewriteImages(content, imagesDir)

		// Create section (one section per chapter — flat structure)
		secResp := learnPost(fmt.Sprintf("/api/courses/%d/sections", courseID), map[string]any{
			"title":      entry.Title,
			"sort_order": i,
		})
		if secResp["id"] == nil {
			log.Error().Str("title", entry.Title).Any("resp", secResp).Msg("failed to create section")
			continue
		}
		sectionID := int64(secResp["id"].(float64))

		// Create page within section
		learnPost(fmt.Sprintf("/api/sections/%d/pages", sectionID), map[string]any{
			"title":      entry.Title,
			"content":    content,
			"sort_order": 0,
		})

		wordCount := len(strings.Fields(content))
		log.Info().
			Int("page", i+1).
			Int("words", wordCount).
			Int("images", imgCount).
			Msg("uploaded")
	}

	// Publish
	learnPost(fmt.Sprintf("/api/courses/%d/publish", courseID), nil)
	log.Info().
		Str("url", apiBase+"/courses/"+learnSlug).
		Msg("course published")
}

func bbgFetchHTML(urlPath string) string {
	fullURL := "https://bytebytego.com" + urlPath
	cmd := exec.Command("curl", "-s", "-L",
		fullURL,
		"-H", "Cookie: "+bbgCookie,
		"-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
		"-H", `sec-ch-ua: "Chromium";v="136", "Not-A.Brand";v="24", "Google Chrome";v="136"`,
		"-H", "sec-ch-ua-mobile: ?0",
		"-H", `sec-ch-ua-platform: "macOS"`,
		"-H", "sec-fetch-dest: document",
		"-H", "sec-fetch-mode: navigate",
		"-H", "sec-fetch-site: same-origin",
	)
	out, err := cmd.Output()
	if err != nil {
		log.Error().Err(err).Str("url", fullURL).Msg("curl failed")
		return ""
	}

	html := string(out)

	re := regexp.MustCompile(`"buildId"\s*:\s*"([^"]+)"`)
	if m := re.FindStringSubmatch(html); len(m) > 1 {
		buildID = m[1]
		log.Debug().Str("buildId", buildID).Msg("discovered Next.js buildId")
	}

	return html
}

func extractPageProps(html string) *pageProps {
	re := regexp.MustCompile(`__NEXT_DATA__" type="application/json">(.*?)</script>`)
	m := re.FindStringSubmatch(html)
	if len(m) < 2 {
		return nil
	}

	var wrapper struct {
		Props struct {
			PageProps pageProps `json:"pageProps"`
		} `json:"props"`
	}
	if err := json.Unmarshal([]byte(m[1]), &wrapper); err != nil {
		log.Error().Err(err).Msg("failed to parse __NEXT_DATA__")
		return nil
	}
	return &wrapper.Props.PageProps
}

func fetchPageContent(courseSlug, pageSlug string) string {
	apiURL := fmt.Sprintf("https://bytebytego.com/_next/data/%s/courses/%s/%s.json",
		buildID, courseSlug, pageSlug)

	cmd := exec.Command("curl", "-s",
		apiURL,
		"-H", "Cookie: "+bbgCookie,
		"-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
		"-H", "Referer: https://bytebytego.com/courses/"+courseSlug,
		"-H", "sec-fetch-dest: empty",
		"-H", "sec-fetch-mode: cors",
		"-H", "sec-fetch-site: same-origin",
	)
	out, err := cmd.Output()
	if err != nil {
		log.Error().Err(err).Str("page", pageSlug).Msg("curl failed for page")
		return ""
	}

	var data struct {
		PageProps struct {
			Code  string `json:"code"`
			Title string `json:"title"`
		} `json:"pageProps"`
	}
	if err := json.Unmarshal(out, &data); err != nil {
		log.Error().Err(err).Str("page", pageSlug).Msg("failed to parse page JSON")
		return ""
	}

	if data.PageProps.Code == "" {
		log.Warn().Str("page", pageSlug).Msg("no code in response — may require auth")
		return ""
	}

	return renderJSXToHTML(data.PageProps.Code)
}

func renderJSXToHTML(code string) string {
	scriptDir := envOr("LEARN_PROJECT_DIR", ".")
	scriptPath, _ := filepath.Abs(filepath.Join(scriptDir, "scripts", "render-bbg-mdx.js"))

	input, _ := json.Marshal(map[string]string{"code": code})

	cmd := exec.Command("node", scriptPath)
	cmd.Stdin = bytes.NewReader(input)
	cmd.Stderr = os.Stderr

	out, err := cmd.Output()
	if err != nil {
		log.Error().Err(err).Msg("JSX renderer failed")
		return ""
	}

	return string(out)
}

var imgSrcRe = regexp.MustCompile(`src="(/images/courses/[^"]+)"`)

func downloadAndRewriteImages(content, imagesDir string) (string, int) {
	matches := imgSrcRe.FindAllStringSubmatch(content, -1)
	if len(matches) == 0 {
		return content, 0
	}

	downloaded := 0
	for _, match := range matches {
		imgPath := match[1]
		imgURL := "https://bytebytego.com" + imgPath

		hash := fmt.Sprintf("%x", sha256.Sum256([]byte(imgURL)))[:12]
		ext := path.Ext(imgPath)
		if ext == "" || len(ext) > 5 {
			ext = ".png"
		}
		filename := hash + ext
		localPath := filepath.Join(imagesDir, filename)

		// Skip if already downloaded
		if _, err := os.Stat(localPath); err == nil {
			content = strings.ReplaceAll(content, imgPath, "/images/"+filename)
			downloaded++
			continue
		}

		// Download via curl — images may need cookie for non-free chapters
		dlCmd := exec.Command("curl", "-s", "-L", "-o", localPath, imgURL,
			"-H", "Cookie: "+bbgCookie,
			"-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
			"-H", "Referer: https://bytebytego.com/",
		)
		if err := dlCmd.Run(); err != nil {
			log.Warn().Err(err).Str("url", imgURL).Msg("image download failed")
			continue
		}

		info, err := os.Stat(localPath)
		if err != nil || info.Size() < 100 {
			os.Remove(localPath)
			log.Warn().Str("url", imgURL).Msg("downloaded file too small, skipping")
			continue
		}

		actualExt := detectFileType(localPath)
		if actualExt != "" && actualExt != ext {
			newFilename := hash + actualExt
			newPath := filepath.Join(imagesDir, newFilename)
			os.Rename(localPath, newPath)
			filename = newFilename
		}

		content = strings.ReplaceAll(content, imgPath, "/images/"+filename)
		downloaded++
	}

	return content, downloaded
}

func detectFileType(fpath string) string {
	f, err := os.Open(fpath)
	if err != nil {
		return ""
	}
	defer f.Close()

	buf := make([]byte, 512)
	n, _ := f.Read(buf)
	if n == 0 {
		return ""
	}
	content := string(buf[:n])

	if strings.Contains(content, "<svg") || (strings.Contains(content, "<?xml") && strings.Contains(content, "svg")) {
		return ".svg"
	}
	if n >= 4 && buf[0] == 0x89 && buf[1] == 0x50 && buf[2] == 0x4E && buf[3] == 0x47 {
		return ".png"
	}
	if n >= 2 && buf[0] == 0xFF && buf[1] == 0xD8 {
		return ".jpg"
	}
	if n >= 3 && string(buf[:3]) == "GIF" {
		return ".gif"
	}
	if n >= 12 && string(buf[:4]) == "RIFF" && string(buf[8:12]) == "WEBP" {
		return ".webp"
	}
	return ""
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

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
