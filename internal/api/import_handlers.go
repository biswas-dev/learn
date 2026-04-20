package api

import (
	"archive/tar"
	"compress/gzip"
	"encoding/json"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/biswas-dev/learn/internal/images"
	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
)

type ImportHandler struct {
	store    store.Store
	imgStore images.Store
}

func (h *ImportHandler) ImportCourse(w http.ResponseWriter, r *http.Request) {
	user := UserFromCtx(r.Context())

	if err := r.ParseMultipartForm(100 << 20); err != nil { // 100MB max
		jsonError(w, "file too large or invalid form", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	gzr, err := gzip.NewReader(file)
	if err != nil {
		jsonError(w, "invalid gzip file", http.StatusBadRequest)
		return
	}
	defer gzr.Close()

	tr := tar.NewReader(gzr)

	var manifest *models.ImportManifest
	files := make(map[string]string) // filename -> content

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			jsonError(w, "failed to read archive", http.StatusBadRequest)
			return
		}

		if header.Typeflag != tar.TypeReg {
			continue
		}

		name := filepath.Base(header.Name)
		data, err := io.ReadAll(io.LimitReader(tr, 10<<20)) // 10MB per file
		if err != nil {
			continue
		}

		if name == "manifest.json" {
			var m models.ImportManifest
			if err := json.Unmarshal(data, &m); err != nil {
				jsonError(w, "invalid manifest.json", http.StatusBadRequest)
				return
			}
			manifest = &m
		} else if strings.HasSuffix(name, ".md") {
			files[name] = string(data)
		}
	}

	if manifest == nil {
		jsonError(w, "manifest.json not found in archive", http.StatusBadRequest)
		return
	}

	// Create course
	course := &models.Course{
		Title:       manifest.Course.Title,
		Slug:        slugify(manifest.Course.Title),
		Description: manifest.Course.Description,
		IsProtected: true, // imported courses are protected by default
		CreatedBy:   user.ID,
	}
	if manifest.Course.Slug != "" {
		course.Slug = manifest.Course.Slug
	}
	if err := h.store.CreateCourse(r.Context(), course); err != nil {
		jsonError(w, "failed to create course: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Create sections and pages
	for secIdx, chapter := range manifest.Course.Chapters {
		section := &models.Section{
			CourseID:  course.ID,
			Title:     chapter.Title,
			Slug:      slugify(chapter.Title),
			SortOrder: secIdx,
		}
		if chapter.Slug != "" {
			section.Slug = chapter.Slug
		}
		if err := h.store.CreateSection(r.Context(), section); err != nil {
			continue
		}

		for pageIdx, lesson := range chapter.Lessons {
			content := files[lesson.Filename]
			page := &models.Page{
				SectionID: section.ID,
				Title:     lesson.Title,
				Slug:      slugify(lesson.Title),
				Content:   content,
				SortOrder: pageIdx,
				CreatedBy: user.ID,
			}
			if lesson.Slug != "" {
				page.Slug = lesson.Slug
			}
			h.store.CreatePage(r.Context(), page)
		}
	}

	jsonResp(w, http.StatusCreated, map[string]any{
		"message":   "course imported",
		"course_id": course.ID,
		"slug":      course.Slug,
	})
}

// BulkImport handles the export.tar.gz format from cmd/export-courses.
// It creates all courses, sections, pages and saves images.
func (h *ImportHandler) BulkImport(w http.ResponseWriter, r *http.Request) {
	user := UserFromCtx(r.Context())

	if err := r.ParseMultipartForm(4 << 30); err != nil { // 4GB max
		jsonError(w, "file too large", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	gzr, err := gzip.NewReader(file)
	if err != nil {
		jsonError(w, "invalid gzip file", http.StatusBadRequest)
		return
	}
	defer gzr.Close()

	tr := tar.NewReader(gzr)

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

	var export *exportData
	imageCount := 0

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			jsonError(w, "failed to read archive", http.StatusBadRequest)
			return
		}
		if header.Typeflag != tar.TypeReg {
			continue
		}

		if header.Name == "export.json" {
			data, err := io.ReadAll(io.LimitReader(tr, 100<<20))
			if err != nil {
				jsonError(w, "failed to read export.json", http.StatusBadRequest)
				return
			}
			var d exportData
			if err := json.Unmarshal(data, &d); err != nil {
				jsonError(w, "invalid export.json", http.StatusBadRequest)
				return
			}
			export = &d
		} else if strings.HasPrefix(header.Name, "images/") {
			// Save image file
			imgName := filepath.Base(header.Name)
			if h.imgStore != nil && imgName != "" {
				if !h.imgStore.Exists(imgName) {
					if err := h.imgStore.Save(imgName, io.LimitReader(tr, 50<<20)); err == nil {
						imageCount++
					}
				}
			}
		}
	}

	if export == nil {
		jsonError(w, "export.json not found in archive", http.StatusBadRequest)
		return
	}

	coursesCreated := 0
	pagesCreated := 0

	for _, ec := range export.Courses {
		// Skip if course slug already exists
		existing, _ := h.store.GetCourseBySlug(r.Context(), ec.Slug)
		if existing != nil {
			continue
		}

		course := &models.Course{
			Title:       ec.Title,
			Slug:        ec.Slug,
			Description: ec.Description,
			IsProtected: ec.IsProtected,
			IsPublished: ec.IsPublished,
			CreatedBy:   user.ID,
		}
		if err := h.store.CreateCourse(r.Context(), course); err != nil {
			continue
		}
		coursesCreated++

		for _, es := range ec.Sections {
			section := &models.Section{
				CourseID:  course.ID,
				Title:     es.Title,
				Slug:      es.Slug,
				SortOrder: es.SortOrder,
			}
			if err := h.store.CreateSection(r.Context(), section); err != nil {
				continue
			}

			for _, ep := range es.Pages {
				page := &models.Page{
					SectionID: section.ID,
					Title:     ep.Title,
					Slug:      ep.Slug,
					Content:   ep.Content,
					SortOrder: ep.SortOrder,
					CreatedBy: user.ID,
				}
				h.store.CreatePage(r.Context(), page)
				pagesCreated++
			}
		}
	}

	jsonResp(w, http.StatusCreated, map[string]any{
		"message":         "bulk import complete",
		"courses_created": coursesCreated,
		"pages_created":   pagesCreated,
		"images_saved":    imageCount,
	})
}
