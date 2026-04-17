package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/biswas-dev/learn/internal/store"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

type remoteCourse struct {
	ID   int64  `json:"id"`
	Slug string `json:"slug"`
}

type exportPage struct {
	Title     string `json:"title"`
	Slug      string `json:"slug"`
	Content   string `json:"content"`
	SortOrder int    `json:"sort_order"`
}

type exportSection struct {
	Title     string       `json:"title"`
	Slug      string       `json:"slug"`
	SortOrder int          `json:"sort_order"`
	Pages     []exportPage `json:"pages"`
}

type exportCourse struct {
	Title       string          `json:"title"`
	Slug        string          `json:"slug"`
	Description string          `json:"description"`
	IsProtected bool            `json:"is_protected"`
	IsPublished bool            `json:"is_published"`
	Sections    []exportSection `json:"sections"`
}

type exportData struct {
	Version int            `json:"version"`
	Courses []exportCourse `json:"courses"`
}

func main() {
	zerolog.SetGlobalLevel(zerolog.InfoLevel)
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: "15:04:05"})

	dbPath := envOr("LEARN_DB_PATH", "data/learn.db")
	imagesDir := envOr("LEARN_IMAGES_DIR", "data/images")
	prodURL := envOr("PROD_URL", "https://learn.biswas.me")
	prodToken := os.Getenv("PROD_TOKEN")

	if prodToken == "" {
		// Try to get token from prod
		prodEmail := envOr("PROD_EMAIL", "anshuman@biswas.me")
		prodPass := os.Getenv("PROD_PASSWORD")
		if prodPass == "" {
			log.Fatal().Msg("set PROD_TOKEN or PROD_PASSWORD")
		}
		var err error
		prodToken, err = login(prodURL, prodEmail, prodPass)
		if err != nil {
			log.Fatal().Err(err).Msg("login to prod")
		}
		log.Info().Msg("logged into prod")
	}

	// Step 1: Get remote course slugs
	log.Info().Str("url", prodURL).Msg("fetching remote courses")
	remoteSlugs, err := getRemoteSlugs(prodURL, prodToken)
	if err != nil {
		log.Fatal().Err(err).Msg("fetch remote courses")
	}
	log.Info().Int("remote", len(remoteSlugs)).Msg("remote courses found")

	// Step 2: Get local courses
	db, err := store.NewSQLite(dbPath)
	if err != nil {
		log.Fatal().Err(err).Msg("open local DB")
	}
	defer db.Close()

	ctx := context.Background()
	localCourses, err := db.ListCourses(ctx, true, true)
	if err != nil {
		log.Fatal().Err(err).Msg("list local courses")
	}
	log.Info().Int("local", len(localCourses)).Msg("local courses found")

	// Step 3: Find missing courses
	var missing []int64 // course IDs to sync
	var missingNames []string
	for _, c := range localCourses {
		if !c.IsPublished {
			continue
		}
		if _, exists := remoteSlugs[c.Slug]; !exists {
			missing = append(missing, c.ID)
			missingNames = append(missingNames, c.Title)
		}
	}

	if len(missing) == 0 {
		log.Info().Msg("all courses are already on remote — nothing to sync")
		return
	}

	log.Info().Int("to_sync", len(missing)).Msg("courses missing from remote")
	for i, name := range missingNames {
		fmt.Printf("  %3d. %s\n", i+1, name)
	}
	fmt.Println()

	// Step 4: Sync each course one at a time
	success := 0
	failed := 0
	startTime := time.Now()

	for i, courseID := range missing {
		course, err := syncOneCourse(ctx, db, courseID, imagesDir, prodURL, prodToken, i+1, len(missing))
		if err != nil {
			log.Error().Err(err).Str("course", course).Msg("sync failed")
			failed++
			continue
		}
		success++
	}

	elapsed := time.Since(startTime)
	fmt.Printf("\n========================================\n")
	fmt.Printf("Sync complete in %s\n", elapsed.Round(time.Second))
	fmt.Printf("  Success: %d\n", success)
	fmt.Printf("  Failed:  %d\n", failed)
	fmt.Printf("  Skipped: %d (already on remote)\n", len(localCourses)-len(missing))
	fmt.Printf("========================================\n")
}

func syncOneCourse(ctx context.Context, db *store.SQLiteStore, courseID int64, imagesDir, prodURL, prodToken string, idx, total int) (string, error) {
	course, err := db.GetCourseByID(ctx, courseID)
	if err != nil || course == nil {
		return "?", fmt.Errorf("course %d not found", courseID)
	}

	start := time.Now()
	log.Info().
		Int("num", idx).
		Int("total", total).
		Str("slug", course.Slug).
		Msg(fmt.Sprintf("[%d/%d] Exporting: %s", idx, total, course.Title))

	// Build export for this single course
	ec := exportCourse{
		Title:       course.Title,
		Slug:        course.Slug,
		Description: course.Description,
		IsProtected: course.IsProtected,
		IsPublished: course.IsPublished,
	}

	sections, _ := db.ListSections(ctx, course.ID)
	pageCount := 0
	referencedImages := make(map[string]bool)

	for _, sec := range sections {
		es := exportSection{
			Title:     sec.Title,
			Slug:      sec.Slug,
			SortOrder: sec.SortOrder,
		}
		pages, _ := db.ListPages(ctx, sec.ID)
		for _, pg := range pages {
			fullPage, _ := db.GetPageByID(ctx, pg.ID)
			if fullPage == nil {
				continue
			}
			es.Pages = append(es.Pages, exportPage{
				Title:     fullPage.Title,
				Slug:      fullPage.Slug,
				Content:   fullPage.Content,
				SortOrder: fullPage.SortOrder,
			})
			pageCount++

			// Find referenced images
			for _, part := range strings.Split(fullPage.Content, "/images/") {
				if len(part) > 5 {
					end := strings.IndexAny(part, "\"' )>")
					if end > 0 {
						referencedImages[part[:end]] = true
					}
				}
			}
		}
		ec.Sections = append(ec.Sections, es)
	}

	// Build tar.gz in memory
	var buf bytes.Buffer
	gw := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gw)

	// Write export.json (single course)
	export := exportData{Version: 1, Courses: []exportCourse{ec}}
	jsonData, _ := json.Marshal(export)
	tw.WriteHeader(&tar.Header{Name: "export.json", Size: int64(len(jsonData)), Mode: 0644})
	tw.Write(jsonData)

	// Add only referenced images
	imgCount := 0
	for imgName := range referencedImages {
		path := filepath.Join(imagesDir, imgName)
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		tw.WriteHeader(&tar.Header{Name: "images/" + imgName, Size: int64(len(data)), Mode: 0644})
		tw.Write(data)
		imgCount++
	}

	tw.Close()
	gw.Close()

	archiveSize := buf.Len()
	log.Info().
		Int("pages", pageCount).
		Int("images", imgCount).
		Str("size", humanSize(int64(archiveSize))).
		Msg(fmt.Sprintf("[%d/%d] Uploading: %s", idx, total, course.Slug))

	// Upload to prod
	err = uploadArchive(prodURL, prodToken, &buf, course.Slug)
	if err != nil {
		return course.Title, err
	}

	elapsed := time.Since(start)
	log.Info().
		Str("elapsed", elapsed.Round(time.Millisecond).String()).
		Msg(fmt.Sprintf("[%d/%d] Done: %s", idx, total, course.Title))

	return course.Title, nil
}

func getRemoteSlugs(prodURL, token string) (map[string]bool, error) {
	req, _ := http.NewRequest("GET", prodURL+"/api/courses", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var courses []remoteCourse
	if err := json.NewDecoder(resp.Body).Decode(&courses); err != nil {
		return nil, err
	}

	slugs := make(map[string]bool, len(courses))
	for _, c := range courses {
		slugs[c.Slug] = true
	}
	return slugs, nil
}

func login(prodURL, email, password string) (string, error) {
	body, _ := json.Marshal(map[string]string{"email": email, "password": password})
	resp, err := http.DefaultClient.Post(prodURL+"/api/auth/login", "application/json", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var result struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if result.Token == "" {
		return "", fmt.Errorf("login failed: no token returned")
	}
	return result.Token, nil
}

func uploadArchive(prodURL, token string, archive *bytes.Buffer, slug string) error {
	// Create multipart form
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", slug+".tar.gz")
	if err != nil {
		return err
	}
	if _, err := io.Copy(part, archive); err != nil {
		return err
	}
	writer.Close()

	req, _ := http.NewRequest("POST", prodURL+"/api/import/bulk", &body)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("upload failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("upload returned %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func humanSize(b int64) string {
	const (
		kb = 1024
		mb = kb * 1024
	)
	switch {
	case b >= mb:
		return fmt.Sprintf("%.1f MB", float64(b)/float64(mb))
	case b >= kb:
		return fmt.Sprintf("%.1f KB", float64(b)/float64(kb))
	default:
		return fmt.Sprintf("%d B", b)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
