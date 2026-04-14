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
	"context"
	"os/exec"
	"os/signal"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"time"
)

var (
	apiBase  = envOr("LEARN_API_URL", "http://localhost:8080")
	apiKey   = os.Getenv("LEARN_API_KEY")
	eduCookie = os.Getenv("EDU_COOKIE") // paste the full Cookie header from Chrome DevTools
	courseURL = envOr("EDU_COURSE_URL", "https://www.educative.io/courses/grokking-the-engineering-management-and-leadership-interviews/")
	nonAlpha = regexp.MustCompile(`[^a-z0-9]+`)
)

func main() {
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "LEARN_API_KEY is required")
		os.Exit(1)
	}
	if eduCookie == "" {
		// Try loading from file
		data, err := os.ReadFile(envOr("EDU_COOKIE_FILE", os.Getenv("HOME")+"/.config/go-educative/cookie.txt"))
		if err != nil {
			fmt.Fprintln(os.Stderr, "EDU_COOKIE is required (or save cookie to ~/.config/go-educative/cookie.txt)")
			os.Exit(1)
		}
		eduCookie = strings.TrimSpace(string(data))
	}

	// Save cookie for next run
	cookieFile := os.Getenv("HOME") + "/.config/go-educative/cookie.txt"
	os.MkdirAll(os.Getenv("HOME")+"/.config/go-educative", 0700)
	os.WriteFile(cookieFile, []byte(eduCookie), 0600)
	fmt.Printf("Cookie saved to %s for reuse\n", cookieFile)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()
	_ = ctx

	// Images directory — where downloaded images are stored and served from
	imagesDir := envOr("LEARN_IMAGES_DIR", "data/images")
	os.MkdirAll(imagesDir, 0755)

	// Extract authorId and collectionId
	authorID := envOr("EDU_AUTHOR_ID", "")
	collectionID := envOr("EDU_COLLECTION_ID", "")
	if authorID == "" || collectionID == "" {
		fmt.Println("Fetching course page to extract IDs...")
		authorID, collectionID = extractIDsFromPage(courseURL)
	}
	if authorID == "" || collectionID == "" {
		// Try the course structure API to discover IDs
		fmt.Println("Page extraction failed, trying API discovery...")
		authorID, collectionID = discoverIDsViaAPI(courseURL)
	}
	if authorID == "" || collectionID == "" {
		fatal("extract IDs", fmt.Errorf("authorId=%q collectionId=%q — set EDU_AUTHOR_ID and EDU_COLLECTION_ID env vars", authorID, collectionID))
	}
	fmt.Printf("  authorId: %s, collectionId: %s\n", authorID, collectionID)

	// Step 2: Fetch course structure via API
	fmt.Println("Fetching course structure...")
	courseAPIURL := fmt.Sprintf("https://www.educative.io/api/collection/%s/%s?work_type=collection", authorID, collectionID)
	courseData := eduGet(courseAPIURL)

	instance, _ := courseData["instance"].(map[string]any)
	if instance == nil {
		fmt.Println("Course API response:")
		raw, _ := json.MarshalIndent(courseData, "", "  ")
		fmt.Println(string(raw))
		fatal("course API", fmt.Errorf("no instance in response — cookie may be expired"))
	}
	details, _ := instance["details"].(map[string]any)
	title, _ := details["title"].(string)
	desc, _ := details["description"].(string)
	fmt.Printf("Course: %s\n", title)

	// Step 3: Create course in learn
	courseResp := learnPost("/api/courses", map[string]any{
		"title":        title,
		"description":  desc,
		"is_protected": true,
	})
	if courseResp["id"] == nil {
		fatal("create course", fmt.Errorf("API returned: %v", courseResp))
	}
	courseID := int64(courseResp["id"].(float64))
	courseSlug, _ := courseResp["slug"].(string)
	fmt.Printf("Created course in learn: id=%d slug=%s\n", courseID, courseSlug)

	// Step 4: Extract TOC and scrape
	toc, _ := details["toc"].(map[string]any)
	categories, _ := toc["categories"].([]any)

	totalLessons := 0
	for _, cat := range categories {
		catMap, _ := cat.(map[string]any)
		pages, _ := catMap["pages"].([]any)
		totalLessons += len(pages)
	}
	fmt.Printf("Found %d chapters, %d total lessons\n\n", len(categories), totalLessons)

	// ── Pass 1: Fetch all pages via API and identify those needing Playwright ──
	type pageData struct {
		secIdx, pgIdx int
		title, slug   string
		content       string // raw HTML after component processing
		needsBrowser  bool   // true if has unresolved LazyLoadPlaceholders
	}
	type sectionData struct {
		title string
		pages []pageData
	}
	var sections []sectionData
	var browserSlugs []string

	lessonIdx := 0
	for secIdx, cat := range categories {
		catMap, _ := cat.(map[string]any)
		chTitle, _ := catMap["title"].(string)
		sec := sectionData{title: chTitle}

		catPages, _ := catMap["pages"].([]any)
		for pgIdx, pg := range catPages {
			pgMap, _ := pg.(map[string]any)
			pgTitle, _ := pgMap["title"].(string)
			pgID := jsonStrOrFloat(pgMap, "id")
			pgSlug, _ := pgMap["slug"].(string)
			lessonIdx++

			fmt.Printf("  [%d/%d] Fetching: %s ...", lessonIdx, totalLessons, pgTitle)

			// Rate limit: 2-4 second delay
			delay := 2*time.Second + time.Duration(rand.Int63n(int64(2*time.Second)))
			time.Sleep(delay)

			content := fetchLesson(authorID, collectionID, pgID, pgSlug)
			if content == "" {
				fmt.Println(" EMPTY")
				sec.pages = append(sec.pages, pageData{secIdx: secIdx, pgIdx: pgIdx, title: pgTitle, slug: pgSlug})
				continue
			}

			// Check if content has unresolved LazyLoadPlaceholder markers
			needsBrowser := false
			if strings.Contains(content, "<!-- lazy-unresolved-") {
				needsBrowser = true
				browserSlugs = append(browserSlugs, pgSlug)
			}

			wordCount := len(strings.Fields(content))
			fmt.Printf(" OK (%d words)\n", wordCount)
			sec.pages = append(sec.pages, pageData{secIdx: secIdx, pgIdx: pgIdx, title: pgTitle, slug: pgSlug, content: content, needsBrowser: needsBrowser})
		}
		sections = append(sections, sec)
	}

	// ── Pass 2: Batch Playwright extraction for pages that need it ──
	var playwrightResults map[string][]string
	if len(browserSlugs) > 0 {
		fmt.Printf("\nExtracting diagrams via browser for %d pages...\n", len(browserSlugs))
		playwrightResults = batchPlaywrightExtract(browserSlugs, imagesDir)
		fmt.Printf("Browser extraction complete: %d pages processed\n\n", len(playwrightResults))
	}

	// ── Pass 3: Upload all pages to learn ──
	lessonIdx = 0
	for secIdx, sec := range sections {
		secResp := learnPost(fmt.Sprintf("/api/courses/%d/sections", courseID), map[string]any{
			"title":      sec.title,
			"sort_order": secIdx,
		})
		sectionID := int64(secResp["id"].(float64))
		fmt.Printf("## %s (section_id=%d)\n", sec.title, sectionID)

		for _, pg := range sec.pages {
			lessonIdx++
			content := pg.content

			// Inject Playwright-extracted images at exact placeholder positions
			if pg.needsBrowser && playwrightResults != nil {
				if imgs, ok := playwrightResults[pg.slug]; ok && len(imgs) > 0 {
					for i, imgPath := range imgs {
						marker := fmt.Sprintf("<!-- lazy-unresolved-%d -->", i)
						replacement := fmt.Sprintf(`<figure class="edu-image"><img src="%s" alt="diagram" /></figure>`, imgPath)
						content = strings.Replace(content, marker, replacement, 1)
					}
				}
				// Remove any remaining unresolved markers (more placeholders than images)
				for i := 0; i < 50; i++ {
					content = strings.Replace(content, fmt.Sprintf("<!-- lazy-unresolved-%d -->", i), "", 1)
				}
			}

			// Download external images and rewrite URLs
			content, imgCount := downloadAndRewriteImages(content, imagesDir)

			fmt.Printf("  [%d/%d] Uploading: %s", lessonIdx, totalLessons, pg.title)

			learnPost(fmt.Sprintf("/api/sections/%d/pages", sectionID), map[string]any{
				"title":      pg.title,
				"content":    content,
				"sort_order": pg.pgIdx,
			})

			imgInfo := ""
			if imgCount > 0 {
				imgInfo = fmt.Sprintf(", %d imgs", imgCount)
			}
			fmt.Printf(" OK (%d words%s)\n", len(strings.Fields(content)), imgInfo)
		}
	}

	// Publish
	learnPost(fmt.Sprintf("/api/courses/%d/publish", courseID), nil)
	fmt.Printf("\nDone! Course published: %s/courses/%s\n", apiBase, courseSlug)
}

// eduGet makes an authenticated GET request to educative.io API.
// eduGet uses curl to make requests — Go's TLS fingerprint gets blocked by Cloudflare.
func eduGet(apiURL string) map[string]any {
	cmd := exec.Command("curl", "-s",
		apiURL,
		"-H", "Cookie: "+eduCookie,
		"-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
		"-H", `sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"`,
		"-H", "sec-ch-ua-mobile: ?0",
		"-H", `sec-ch-ua-platform: "macOS"`,
		"-H", "sec-fetch-dest: empty",
		"-H", "sec-fetch-mode: no-cors",
		"-H", "sec-fetch-site: same-origin",
		"-H", "Referer: "+courseURL,
	)
	out, err := cmd.Output()
	if err != nil {
		fmt.Fprintf(os.Stderr, "\ncurl error: %v\n", err)
		return nil
	}
	var result map[string]any
	json.Unmarshal(out, &result)
	return result
}

func extractIDsFromPage(courseURL string) (string, string) {
	cmd := exec.Command("curl", "-s", courseURL,
		"-H", "Cookie: "+eduCookie,
		"-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
	)
	body, err := cmd.Output()
	if err != nil {
		return "", ""
	}
	html := string(body)

	// Extract IDs from HTML
	authorRe := regexp.MustCompile(`"author_id"\s*:\s*"?(\d+)"?`)
	collRe := regexp.MustCompile(`"collection_id"\s*:\s*"?(\d+)"?`)

	var authorID, collectionID string
	if m := authorRe.FindStringSubmatch(html); len(m) > 1 {
		authorID = m[1]
	}
	if m := collRe.FindStringSubmatch(html); len(m) > 1 {
		collectionID = m[1]
	}

	// Fallback: try API URL pattern
	if authorID == "" || collectionID == "" {
		apiRe := regexp.MustCompile(`api/collection/(\d+)/(\d+)`)
		if m := apiRe.FindStringSubmatch(html); len(m) > 2 {
			authorID = m[1]
			collectionID = m[2]
		}
	}

	return authorID, collectionID
}

func discoverIDsViaAPI(courseURL string) (string, string) {
	// Try fetching the course page and look for API calls in the response
	// Fallback: extract slug from URL and try known API patterns
	slug := ""
	parts := strings.Split(strings.TrimRight(courseURL, "/"), "/")
	for i, p := range parts {
		if p == "courses" && i+1 < len(parts) {
			slug = parts[i+1]
			break
		}
	}
	if slug == "" {
		return "", ""
	}

	// Try the search/lookup API
	searchURL := fmt.Sprintf("https://www.educative.io/api/reader/collection?slug=%s", slug)
	data := eduGet(searchURL)
	if data != nil {
		if authorID, ok := data["author_id"].(string); ok {
			collID, _ := data["collection_id"].(string)
			return authorID, collID
		}
		if authorID, ok := data["author_id"].(float64); ok {
			collID, _ := data["collection_id"].(float64)
			return fmt.Sprintf("%.0f", authorID), fmt.Sprintf("%.0f", collID)
		}
	}
	return "", ""
}

func fetchLesson(authorID, collectionID, pageID, pageSlug string) string {
	url := fmt.Sprintf("https://www.educative.io/api/collection/%s/%s/page/%s?work_type=collection",
		authorID, collectionID, pageID)

	data := eduGet(url)

	// Check for errors
	if errText, ok := data["errorText"].(string); ok {
		fmt.Fprintf(os.Stderr, "\n    API error: %s", errText)
		return ""
	}

	components, ok := data["components"].([]any)
	if !ok {
		if body, ok := data["body"].(string); ok && body != "" {
			return body
		}
		keys := make([]string, 0)
		for k := range data {
			keys = append(keys, k)
		}
		if len(keys) > 0 {
			fmt.Fprintf(os.Stderr, "\n    No components, keys: %v", keys)
		}
		return ""
	}

	// Resolve LazyLoadPlaceholder components with MxGraphWidget
	components = resolveLazyLoads(components, pageSlug)

	// Extract summary description if present
	var descriptionHTML string
	if summary, ok := data["summary"].(map[string]any); ok {
		if desc, ok := summary["description"].(string); ok && desc != "" {
			descriptionHTML = fmt.Sprintf(`<p class="edu-summary"><em>%s</em></p>`+"\n\n", desc)
		}
	}

	return descriptionHTML + componentsToMarkdown(components)
}

func componentsToMarkdown(components []any) string {
	var sb strings.Builder
	for _, comp := range components {
		compMap, ok := comp.(map[string]any)
		if !ok {
			continue
		}
		compType, _ := compMap["type"].(string)

		switch compType {
		case "text", "markdown", "Markdown", "Text":
			content, _ := compMap["content"].(string)
			if content == "" {
				if cm, ok := compMap["content"].(map[string]any); ok {
					content, _ = cm["text"].(string)
				}
			}
			if content != "" {
				sb.WriteString(content)
				sb.WriteString("\n\n")
			}
		case "SlateHTML", "slate_html":
			cm, _ := compMap["content"].(map[string]any)
			html, _ := cm["html"].(string)
			if html != "" {
				sb.WriteString(html)
				sb.WriteString("\n\n")
			}
		case "MarkdownEditor", "markdown_editor":
			cm, _ := compMap["content"].(map[string]any)
			// Prefer mdHtml (rendered), fall back to text (raw markdown)
			mdHtml, _ := cm["mdHtml"].(string)
			text, _ := cm["text"].(string)
			if mdHtml != "" {
				sb.WriteString(mdHtml)
				sb.WriteString("\n\n")
			} else if text != "" {
				sb.WriteString(text)
				sb.WriteString("\n\n")
			}
		case "Columns", "columns":
			cm, _ := compMap["content"].(map[string]any)
			nested, _ := cm["comps"].([]any)
			if len(nested) > 0 {
				// Recursively process nested components
				sb.WriteString(componentsToMarkdown(nested))
			}
		case "code", "Code":
			cm, _ := compMap["content"].(map[string]any)
			code, _ := cm["code"].(string)
			lang, _ := cm["language"].(string)
			if lang == "" {
				lang, _ = cm["lang"].(string)
			}
			if code != "" {
				sb.WriteString(fmt.Sprintf("```%s\n%s\n```\n\n", lang, code))
			}
			sol, _ := cm["solution"].(string)
			if sol != "" {
				sb.WriteString("<details>\n<summary>Solution</summary>\n\n")
				sb.WriteString(fmt.Sprintf("```%s\n%s\n```\n\n", lang, sol))
				sb.WriteString("</details>\n\n")
			}
		case "TabbedCode", "tabbed_code":
			cm, _ := compMap["content"].(map[string]any)
			tabs, _ := cm["tabs"].([]any)
			for _, tab := range tabs {
				tm, ok := tab.(map[string]any)
				if !ok {
					continue
				}
				name, _ := tm["name"].(string)
				code, _ := tm["code"].(string)
				lang, _ := tm["language"].(string)
				if name != "" {
					sb.WriteString(fmt.Sprintf("**%s:**\n", name))
				}
				sb.WriteString(fmt.Sprintf("```%s\n%s\n```\n\n", lang, code))
			}
		case "EditorCode", "editor_code":
			cm, _ := compMap["content"].(map[string]any)
			code, _ := cm["code"].(string)
			lang, _ := cm["language"].(string)
			if code != "" {
				sb.WriteString(fmt.Sprintf("```%s\n%s\n```\n\n", lang, code))
			}
		case "Quiz", "quiz", "StructuredQuiz", "structured_quiz":
			cm, _ := compMap["content"].(map[string]any)
			q, _ := cm["question"].(string)
			if q != "" {
				sb.WriteString("**Quiz:** " + q + "\n\n")
			}
			opts, _ := cm["options"].([]any)
			for i, o := range opts {
				sb.WriteString(fmt.Sprintf("%d. %v\n", i+1, o))
			}
			if len(opts) > 0 {
				sb.WriteString("\n")
			}
			qs, _ := cm["questions"].([]any)
			for i, qr := range qs {
				qm, ok := qr.(map[string]any)
				if !ok {
					continue
				}
				qt, _ := qm["question"].(string)
				sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, qt))
			}
			if len(qs) > 0 {
				sb.WriteString("\n")
			}
		case "image", "Image":
			cm, _ := compMap["content"].(map[string]any)
			imgURL, _ := cm["imageUrl"].(string)
			imgPath, _ := cm["path"].(string)
			caption, _ := cm["caption"].(string)
			width, _ := cm["width"].(float64)
			if imgURL == "" && imgPath != "" {
				imgURL = "https://www.educative.io" + imgPath
			}
			if caption == "" {
				caption = "image"
			}
			if imgURL != "" {
				// Use HTML img tag with width for proper sizing
				widthAttr := ""
				if width > 0 {
					widthAttr = fmt.Sprintf(` width="%d" style="max-width:%dpx"`, int(width), int(width))
				}
				sb.WriteString(fmt.Sprintf(`<figure class="edu-image"><img src="%s" alt="%s"%s />`, imgURL, caption, widthAttr))
				if caption != "" && caption != "image" {
					sb.WriteString(fmt.Sprintf(`<figcaption>%s</figcaption>`, caption))
				}
				sb.WriteString("</figure>\n\n")
			}
		case "MxGraphWidget", "mx_graph_widget":
			cm, _ := compMap["content"].(map[string]any)
			xml, _ := cm["xml"].(string)
			caption, _ := cm["caption"].(string)
			if xml != "" {
				localPath := mxGraphToPNG(xml, caption)
				if localPath != "" {
					if caption == "" {
						caption = "diagram"
					}
					sb.WriteString(fmt.Sprintf(`<figure class="edu-image"><img src="%s" alt="%s" />`, localPath, caption))
					if caption != "" && caption != "diagram" {
						sb.WriteString(fmt.Sprintf(`<figcaption>%s</figcaption>`, caption))
					}
					sb.WriteString("</figure>\n\n")
				}
			}
		case "DrawIOWidget", "draw_io_widget":
			cm, _ := compMap["content"].(map[string]any)
			// Try XML first (same as MxGraphWidget), fall back to image path
			xml, _ := cm["xml"].(string)
			if xml != "" {
				caption, _ := cm["caption"].(string)
				localPath := mxGraphToPNG(xml, caption)
				if localPath != "" {
					if caption == "" {
						caption = "diagram"
					}
					sb.WriteString(fmt.Sprintf(`<figure class="edu-image"><img src="%s" alt="%s" />`, localPath, caption))
					if caption != "" && caption != "diagram" {
						sb.WriteString(fmt.Sprintf(`<figcaption>%s</figcaption>`, caption))
					}
					sb.WriteString("</figure>\n\n")
				}
			} else {
				imgPath, _ := cm["path"].(string)
				caption, _ := cm["caption"].(string)
				width, _ := cm["width"].(float64)
				if imgPath != "" {
					imgURL := "https://www.educative.io" + imgPath
					widthAttr := ""
					if width > 0 {
						widthAttr = fmt.Sprintf(` width="%d" style="max-width:%dpx"`, int(width), int(width))
					}
					if caption == "" {
						caption = "diagram"
					}
					sb.WriteString(fmt.Sprintf(`<figure class="edu-image"><img src="%s" alt="%s"%s />`, imgURL, caption, widthAttr))
					if caption != "" && caption != "diagram" {
						sb.WriteString(fmt.Sprintf(`<figcaption>%s</figcaption>`, caption))
					}
					sb.WriteString("</figure>\n\n")
				}
			}
		case "Notepad", "notepad":
			cm, _ := compMap["content"].(map[string]any)
			noteTitle, _ := cm["title"].(string)
			placeholder, _ := cm["placeholderText"].(string)
			if noteTitle != "" {
				sb.WriteString(fmt.Sprintf("**%s**\n\n", noteTitle))
			}
			if placeholder != "" {
				sb.WriteString(fmt.Sprintf("> _%s_\n\n", placeholder))
			}
		case "unresolved_marker":
			if content, ok := compMap["content"].(string); ok {
				sb.WriteString(content)
				sb.WriteString("\n\n")
			}
		default:
			if content, ok := compMap["content"].(string); ok && content != "" {
				sb.WriteString(content)
				sb.WriteString("\n\n")
			}
		}
	}
	return sb.String()
}

// mxGraphToPNG converts MxGraph XML to a PNG image using draw.io CLI,
// saves it to the images directory, and returns the /images/... path.
func mxGraphToPNG(xml, caption string) string {
	imagesDir := envOr("LEARN_IMAGES_DIR", "data/images")

	// Hash the XML for a stable filename
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(xml)))[:12]
	filename := hash + ".png"
	localPath := filepath.Join(imagesDir, filename)

	// Skip if already converted
	if _, err := os.Stat(localPath); err == nil {
		return "/images/" + filename
	}

	// Wrap in mxfile/diagram structure if needed (draw.io CLI requires it)
	if !strings.Contains(xml, "<mxfile") {
		xml = `<mxfile><diagram name="Page-1">` + xml + `</diagram></mxfile>`
	}

	// Write XML to temp .drawio file
	tmpFile := filepath.Join(os.TempDir(), hash+".drawio")
	if err := os.WriteFile(tmpFile, []byte(xml), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "\n    mxGraph: failed to write temp file: %v", err)
		return ""
	}
	defer os.Remove(tmpFile)

	// Export via draw.io CLI
	cmd := exec.Command("/opt/homebrew/bin/drawio", "--export", "--format", "png",
		"--scale", "2", "--output", localPath, tmpFile)
	cmd.Env = append(os.Environ(), "ELECTRON_DISABLE_GPU=1")
	out, err := cmd.CombinedOutput()
	if err != nil {
		fmt.Fprintf(os.Stderr, "\n    mxGraph: draw.io export failed: %v: %s", err, string(out))
		return ""
	}

	// Verify output
	info, err := os.Stat(localPath)
	if err != nil || info.Size() < 100 {
		os.Remove(localPath)
		fmt.Fprintf(os.Stderr, "\n    mxGraph: output too small or missing")
		return ""
	}

	return "/images/" + filename
}

// resolveLazyLoads checks for LazyLoadPlaceholder components with MxGraphWidget
// and resolves them by fetching the HTML page to extract the MxGraph XML.
func resolveLazyLoads(components []any, pageSlug string) []any {
	// Count lazy MxGraphWidgets
	lazyCount := 0
	for _, comp := range components {
		cm, _ := comp.(map[string]any)
		if cm["type"] == "LazyLoadPlaceholder" {
			content, _ := cm["content"].(map[string]any)
			if at, _ := content["actualType"].(string); at == "MxGraphWidget" {
				lazyCount++
			}
		}
	}
	if lazyCount == 0 {
		return components
	}

	// Collect MxGraph XMLs already present in the API response (from Columns etc.)
	knownXMLs := collectMxGraphXMLs(components)

	// Fetch the lesson HTML page to extract lazy-loaded MxGraph XMLs
	// Construct lesson URL from course URL + page slug
	lessonURL := strings.TrimRight(courseURL, "/") + "/" + pageSlug
	cmd := exec.Command("curl", "-s", lessonURL,
		"-H", "Cookie: "+eduCookie,
		"-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
	)
	body, err := cmd.Output()
	if err != nil {
		fmt.Fprintf(os.Stderr, "\n    resolveLazy: curl failed: %v", err)
		return components
	}

	// Extract all unique mxGraphModel XML blocks
	htmlStr := string(body)
	htmlStr = strings.ReplaceAll(htmlStr, `\u003c`, "<")
	htmlStr = strings.ReplaceAll(htmlStr, `\u003e`, ">")
	htmlStr = strings.ReplaceAll(htmlStr, `\u0026`, "&")

	re := regexp.MustCompile(`<mxGraphModel>.*?</mxGraphModel>`)
	matches := re.FindAllString(htmlStr, -1)

	// Unescape and deduplicate
	var uniqueXMLs []string
	seen := make(map[string]bool)
	for _, m := range matches {
		m = strings.ReplaceAll(m, `\"`, `"`)
		m = strings.ReplaceAll(m, `\\`, `\`)
		hash := fmt.Sprintf("%x", sha256.Sum256([]byte(m)))[:16]
		if !seen[hash] {
			seen[hash] = true
			// Skip if this XML is already known from the API (Columns etc.)
			if !knownXMLs[hash] {
				uniqueXMLs = append(uniqueXMLs, m)
			}
		}
	}

	if len(uniqueXMLs) == 0 {
		// Mark EACH unresolved LazyLoadPlaceholder with a numbered marker
		// so the batch Playwright pass can replace each one with the right image
		result := make([]any, len(components))
		copy(result, components)
		markerIdx := 0
		for i, comp := range result {
			cm, _ := comp.(map[string]any)
			if cm["type"] == "LazyLoadPlaceholder" {
				content, _ := cm["content"].(map[string]any)
				if at, _ := content["actualType"].(string); at == "MxGraphWidget" {
					result[i] = map[string]any{
						"type":    "unresolved_marker",
						"content": fmt.Sprintf("<!-- lazy-unresolved-%d -->", markerIdx),
					}
					markerIdx++
				}
			}
		}
		return result
	}

	// Replace LazyLoadPlaceholders with resolved MxGraphWidgets
	xmlIdx := 0
	result := make([]any, len(components))
	for i, comp := range components {
		cm, _ := comp.(map[string]any)
		if cm["type"] == "LazyLoadPlaceholder" {
			content, _ := cm["content"].(map[string]any)
			if at, _ := content["actualType"].(string); at == "MxGraphWidget" && xmlIdx < len(uniqueXMLs) {
				result[i] = map[string]any{
					"type": "MxGraphWidget",
					"content": map[string]any{
						"xml":     uniqueXMLs[xmlIdx],
						"caption": "",
					},
				}
				xmlIdx++
				continue
			}
		}
		result[i] = comp
	}
	return result
}

// batchPlaywrightExtract uses Playwright to extract image URLs from educative pages,
// then downloads each image via curl. ONE browser session for all pages.
// Returns map[pageSlug][]localImagePaths.
func batchPlaywrightExtract(pageSlugs []string, imagesDir string) map[string][]string {
	scriptDir := envOr("LEARN_PROJECT_DIR", ".")
	scriptPath, _ := filepath.Abs(filepath.Join(scriptDir, "scripts", "extract-mxgraph.js"))
	frontendDir, _ := filepath.Abs(filepath.Join(scriptDir, "frontend"))

	if _, err := os.Stat(scriptPath); err != nil {
		fmt.Fprintf(os.Stderr, "playwright: script not found at %s\n", scriptPath)
		return nil
	}

	cookieFile := envOr("EDU_COOKIE_FILE", os.Getenv("HOME")+"/.config/go-educative/cookie.txt")

	// Write input JSON
	input := map[string]any{
		"course_url": courseURL,
		"pages":      pageSlugs,
	}
	inputData, _ := json.Marshal(input)
	tmpFile := filepath.Join(os.TempDir(), "playwright-pages.json")
	os.WriteFile(tmpFile, inputData, 0644)
	defer os.Remove(tmpFile)

	cmd := exec.Command("node", scriptPath, tmpFile)
	cmd.Dir = frontendDir
	cmd.Env = append(os.Environ(),
		"NODE_PATH="+filepath.Join(frontendDir, "node_modules"),
		"COOKIE_FILE="+cookieFile,
	)
	cmd.Stderr = os.Stderr

	out, err := cmd.Output()
	if err != nil {
		fmt.Fprintf(os.Stderr, "playwright: failed: %v\n", err)
		return nil
	}

	// Parse URL map from last line of stdout
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	var jsonLine string
	for i := len(lines) - 1; i >= 0; i-- {
		if strings.HasPrefix(strings.TrimSpace(lines[i]), "{") {
			jsonLine = strings.TrimSpace(lines[i])
			break
		}
	}
	if jsonLine == "" {
		return nil
	}

	var urlMap map[string][]string
	if err := json.Unmarshal([]byte(jsonLine), &urlMap); err != nil {
		fmt.Fprintf(os.Stderr, "playwright: failed to parse output: %v\n", err)
		return nil
	}

	// Download each image via curl and return local paths
	results := make(map[string][]string)
	totalDownloaded := 0
	for slug, urls := range urlMap {
		var localPaths []string
		for _, u := range urls {
			imgURL := "https://www.educative.io" + u
			// Hash the URL for filename
			hash := fmt.Sprintf("%x", sha256.Sum256([]byte(u)))[:12]
			ext := ".svg"
			filename := hash + ext
			localPath := filepath.Join(imagesDir, filename)

			// Skip if already downloaded
			if _, err := os.Stat(localPath); err == nil {
				localPaths = append(localPaths, "/images/"+filename)
				continue
			}

			// Download via curl
			dlCmd := exec.Command("curl", "-s", "-o", localPath, imgURL,
				"-H", "Cookie: "+eduCookie,
				"-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
			)
			if err := dlCmd.Run(); err != nil {
				continue
			}

			// Verify file
			info, err := os.Stat(localPath)
			if err != nil || info.Size() < 100 {
				os.Remove(localPath)
				continue
			}

			localPaths = append(localPaths, "/images/"+filename)
			totalDownloaded++
		}
		results[slug] = localPaths
	}
	fmt.Printf("  Downloaded %d diagram images\n", totalDownloaded)
	return results
}

// collectMxGraphXMLs recursively collects hashes of MxGraph XMLs already in the components.
func collectMxGraphXMLs(components []any) map[string]bool {
	known := make(map[string]bool)
	for _, comp := range components {
		cm, _ := comp.(map[string]any)
		if cm == nil {
			continue
		}
		switch cm["type"] {
		case "MxGraphWidget", "mx_graph_widget":
			content, _ := cm["content"].(map[string]any)
			if xml, ok := content["xml"].(string); ok && xml != "" {
				hash := fmt.Sprintf("%x", sha256.Sum256([]byte(xml)))[:16]
				known[hash] = true
			}
		case "Columns", "columns":
			content, _ := cm["content"].(map[string]any)
			nested, _ := content["comps"].([]any)
			for k, v := range collectMxGraphXMLs(nested) {
				known[k] = v
			}
		}
	}
	return known
}

func learnPost(path string, body map[string]any) map[string]any {
	var reqBody io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reqBody = bytes.NewReader(data)
	} else {
		reqBody = bytes.NewReader([]byte("{}"))
	}

	req, _ := http.NewRequest("POST", apiBase+path, reqBody)
	req.Header.Set("Authorization", "ApiKey "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fatal("learn API "+path, err)
	}
	defer resp.Body.Close()

	var result map[string]any
	json.NewDecoder(resp.Body).Decode(&result)
	if resp.StatusCode >= 400 {
		fmt.Fprintf(os.Stderr, "\nLearn API error %d on %s: %v\n", resp.StatusCode, path, result)
	}
	return result
}

func jsonStrOrFloat(m map[string]any, key string) string {
	if s, ok := m[key].(string); ok {
		return s
	}
	if f, ok := m[key].(float64); ok {
		return fmt.Sprintf("%.0f", f)
	}
	return ""
}

// imgSrcRe matches src="..." in img tags and ![alt](url) in markdown
var imgSrcRe = regexp.MustCompile(`(?:src="(https?://[^"]+)"|!\[[^\]]*\]\((https?://[^)]+)\))`)

// downloadAndRewriteImages finds all image URLs in content, downloads them locally,
// and rewrites the URLs to point to /images/<hash>.<ext>
func downloadAndRewriteImages(content, imagesDir string) (string, int) {
	matches := imgSrcRe.FindAllStringSubmatch(content, -1)
	if len(matches) == 0 {
		return content, 0
	}

	downloaded := 0
	for _, match := range matches {
		imgURL := match[1]
		if imgURL == "" {
			imgURL = match[2]
		}
		if imgURL == "" {
			continue
		}

		// Generate a filename from URL hash
		hash := fmt.Sprintf("%x", sha256.Sum256([]byte(imgURL)))[:12]
		ext := path.Ext(imgURL)
		if ext == "" || len(ext) > 5 {
			ext = ".png"
		}
		// Clean ext of query params
		if idx := strings.Index(ext, "?"); idx != -1 {
			ext = ext[:idx]
		}
		filename := hash + ext
		localPath := filepath.Join(imagesDir, filename)

		// Skip if already downloaded
		if _, err := os.Stat(localPath); err == nil {
			content = strings.ReplaceAll(content, imgURL, "/images/"+filename)
			downloaded++
			continue
		}

		// Download via curl — include cookie for educative.io URLs
		args := []string{"-s", "-L", "-o", localPath, imgURL,
			"-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
			"-H", "Referer: https://www.educative.io/",
		}
		if strings.Contains(imgURL, "educative.io") {
			args = append(args, "-H", "Cookie: "+eduCookie)
		}
		cmd := exec.Command("curl", args...)
		if err := cmd.Run(); err != nil {
			continue
		}

		// Verify it's actually an image (not an HTML error page)
		info, err := os.Stat(localPath)
		if err != nil || info.Size() < 100 {
			os.Remove(localPath)
			continue
		}

		// Detect actual file type — educative returns SVGs for DrawIO widgets
		actualExt := detectFileType(localPath)
		if actualExt != "" && actualExt != ext {
			newFilename := hash + actualExt
			newPath := filepath.Join(imagesDir, newFilename)
			os.Rename(localPath, newPath)
			filename = newFilename
		}

		content = strings.ReplaceAll(content, imgURL, "/images/"+filename)
		downloaded++
	}

	return content, downloaded
}

// detectFileType reads the first bytes of a file to determine the actual type.
func detectFileType(path string) string {
	f, err := os.Open(path)
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

	// SVG detection
	if strings.Contains(content, "<svg") || strings.Contains(content, "<?xml") && strings.Contains(content, "svg") {
		return ".svg"
	}
	// PNG magic bytes
	if n >= 4 && buf[0] == 0x89 && buf[1] == 0x50 && buf[2] == 0x4E && buf[3] == 0x47 {
		return ".png"
	}
	// JPEG magic bytes
	if n >= 2 && buf[0] == 0xFF && buf[1] == 0xD8 {
		return ".jpg"
	}
	// GIF
	if n >= 3 && string(buf[:3]) == "GIF" {
		return ".gif"
	}
	// WebP
	if n >= 12 && string(buf[:4]) == "RIFF" && string(buf[8:12]) == "WEBP" {
		return ".webp"
	}
	return ""
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func fatal(context string, err error) {
	fmt.Fprintf(os.Stderr, "FATAL [%s]: %v\n", context, err)
	os.Exit(1)
}
