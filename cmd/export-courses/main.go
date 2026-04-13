package main

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/biswas-dev/learn/internal/store"
)

// Exports all courses from the local learn DB into a .tar.gz archive
// that can be imported into production via the /api/import/bulk endpoint.
//
// The archive contains:
//   export.json  — all courses, sections, pages with content
//   images/      — all image files

func main() {
	dbPath := envOr("LEARN_DB_PATH", "data/learn.db")
	imagesDir := envOr("LEARN_IMAGES_DIR", "data/images")
	outputFile := envOr("EXPORT_FILE", "learn-export.tar.gz")

	db, err := store.NewSQLite(dbPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to open DB: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	ctx := context.Background()

	// Fetch all courses with full content
	courses, err := db.ListCourses(ctx, true, true)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to list courses: %v\n", err)
		os.Exit(1)
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

	var export exportData
	export.Version = 1

	for _, course := range courses {
		ec := exportCourse{
			Title:       course.Title,
			Slug:        course.Slug,
			Description: course.Description,
			IsProtected: course.IsProtected,
			IsPublished: course.IsPublished,
		}

		sections, _ := db.ListSections(ctx, course.ID)
		for _, sec := range sections {
			es := exportSection{
				Title:     sec.Title,
				Slug:      sec.Slug,
				SortOrder: sec.SortOrder,
			}

			// Get pages WITH content (ListPages returns empty content, need GetPageByID)
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
			}

			ec.Sections = append(ec.Sections, es)
		}

		export.Courses = append(export.Courses, ec)
		fmt.Printf("Exported: %s (%d sections)\n", course.Title, len(ec.Sections))
	}

	// Create tar.gz
	f, err := os.Create(outputFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create output: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	gw := gzip.NewWriter(f)
	defer gw.Close()
	tw := tar.NewWriter(gw)
	defer tw.Close()

	// Write export.json
	jsonData, _ := json.MarshalIndent(export, "", "  ")
	tw.WriteHeader(&tar.Header{
		Name: "export.json",
		Size: int64(len(jsonData)),
		Mode: 0644,
	})
	tw.Write(jsonData)

	// Add all images
	imgCount := 0
	if entries, err := os.ReadDir(imagesDir); err == nil {
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			path := filepath.Join(imagesDir, entry.Name())
			info, err := entry.Info()
			if err != nil {
				continue
			}

			data, err := os.ReadFile(path)
			if err != nil {
				continue
			}

			tw.WriteHeader(&tar.Header{
				Name: "images/" + entry.Name(),
				Size: info.Size(),
				Mode: 0644,
			})
			tw.Write(data)
			imgCount++
		}
	}

	// Collect referenced images from content to report coverage
	referencedImages := make(map[string]bool)
	for _, c := range export.Courses {
		for _, s := range c.Sections {
			for _, p := range s.Pages {
				// Find /images/xxx references
				for _, part := range strings.Split(p.Content, "/images/") {
					if len(part) > 5 {
						end := strings.IndexAny(part, "\"' )>")
						if end > 0 {
							referencedImages[part[:end]] = true
						}
					}
				}
			}
		}
	}

	fmt.Printf("\nExport complete:\n")
	fmt.Printf("  Courses: %d\n", len(export.Courses))
	fmt.Printf("  Images:  %d files (%d referenced in content)\n", imgCount, len(referencedImages))
	fmt.Printf("  Output:  %s\n", outputFile)

	stat, _ := os.Stat(outputFile)
	fmt.Printf("  Size:    %.1f MB\n", float64(stat.Size())/1024/1024)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Ensure io import is used
var _ = io.EOF
