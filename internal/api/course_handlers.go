package api

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
	"github.com/go-chi/chi/v5"
)

type CourseHandler struct {
	store store.Store
}

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	slug := slugRe.ReplaceAllString(strings.ToLower(strings.TrimSpace(s)), "-")
	return strings.Trim(slug, "-")
}

func (h *CourseHandler) List(w http.ResponseWriter, r *http.Request) {
	user := UserFromCtx(r.Context())
	includeUnpublished := false
	includeProtected := false
	if user != nil && user.Role.Level() >= models.RoleEditor.Level() {
		includeUnpublished = true
		includeProtected = true
	}

	// If pagination params present, use paginated listing
	pageStr := r.URL.Query().Get("page")
	sizeStr := r.URL.Query().Get("size")
	category := r.URL.Query().Get("category")
	tag := r.URL.Query().Get("tag")

	if pageStr != "" || category != "" || tag != "" {
		page, _ := strconv.Atoi(pageStr)
		size, _ := strconv.Atoi(sizeStr)
		if page < 1 {
			page = 1
		}
		if size <= 0 {
			size = 24
		}
		result, err := h.store.ListCoursesPaginated(r.Context(), page, size, category, tag, includeProtected)
		if err != nil {
			jsonError(w, "failed to list courses", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
		jsonResp(w, http.StatusOK, result)
		return
	}

	// Default: return all courses (backward compatible)
	courses, err := h.store.ListCourses(r.Context(), includeUnpublished, includeProtected)
	if err != nil {
		jsonError(w, "failed to list courses", http.StatusInternalServerError)
		return
	}
	if courses == nil {
		courses = []models.Course{}
	}
	jsonResp(w, http.StatusOK, courses)
}

func (h *CourseHandler) Search(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		jsonResp(w, http.StatusOK, []models.CourseSummary{})
		return
	}
	limitStr := r.URL.Query().Get("limit")
	limit, _ := strconv.Atoi(limitStr)
	if limit <= 0 {
		limit = 20
	}

	results, err := h.store.SearchCourses(r.Context(), query, limit)
	if err != nil {
		jsonError(w, "search failed", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=60")
	jsonResp(w, http.StatusOK, results)
}

func (h *CourseHandler) GetBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "courseSlug")
	course, err := h.store.GetCourseBySlug(r.Context(), slug)
	if err != nil || course == nil {
		jsonError(w, "course not found", http.StatusNotFound)
		return
	}

	user := UserFromCtx(r.Context())
	if course.IsProtected && (user == nil || user.Role.Level() < models.RoleEditor.Level()) {
		jsonError(w, "access denied", http.StatusForbidden)
		return
	}
	if !course.IsPublished && (user == nil || user.Role.Level() < models.RoleEditor.Level()) {
		jsonError(w, "course not found", http.StatusNotFound)
		return
	}

	// Load sections with page metadata
	sections, err := h.store.ListSections(r.Context(), course.ID)
	if err == nil {
		for i := range sections {
			pages, err := h.store.ListPages(r.Context(), sections[i].ID)
			if err == nil {
				sections[i].Pages = pages
			}
		}
		course.Sections = sections
	}

	jsonResp(w, http.StatusOK, course)
}

func (h *CourseHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := UserFromCtx(r.Context())
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		IsProtected bool   `json:"is_protected"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Title == "" {
		jsonError(w, "title is required", http.StatusBadRequest)
		return
	}

	course := &models.Course{
		Title:       req.Title,
		Slug:        slugify(req.Title),
		Description: req.Description,
		IsProtected: req.IsProtected,
		CreatedBy:   user.ID,
	}
	if err := h.store.CreateCourse(r.Context(), course); err != nil {
		jsonError(w, "failed to create course", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusCreated, course)
}

func (h *CourseHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "courseId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid course id", http.StatusBadRequest)
		return
	}

	course, err := h.store.GetCourseByID(r.Context(), id)
	if err != nil || course == nil {
		jsonError(w, "course not found", http.StatusNotFound)
		return
	}

	var req struct {
		Title         string `json:"title"`
		Description   string `json:"description"`
		IsProtected   *bool  `json:"is_protected"`
		CoverImageURL string `json:"cover_image_url"`
		SortOrder     *int   `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Title != "" {
		course.Title = req.Title
		course.Slug = slugify(req.Title)
	}
	if req.Description != "" {
		course.Description = req.Description
	}
	if req.IsProtected != nil {
		course.IsProtected = *req.IsProtected
	}
	if req.CoverImageURL != "" {
		course.CoverImageURL = req.CoverImageURL
	}
	if req.SortOrder != nil {
		course.SortOrder = *req.SortOrder
	}

	if err := h.store.UpdateCourse(r.Context(), course); err != nil {
		jsonError(w, "failed to update course", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusOK, course)
}

func (h *CourseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "courseId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid course id", http.StatusBadRequest)
		return
	}
	if err := h.store.DeleteCourse(r.Context(), id); err != nil {
		jsonError(w, "failed to delete course", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

func (h *CourseHandler) Publish(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "courseId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid course id", http.StatusBadRequest)
		return
	}

	course, err := h.store.GetCourseByID(r.Context(), id)
	if err != nil || course == nil {
		jsonError(w, "course not found", http.StatusNotFound)
		return
	}

	if err := h.store.SetCoursePublished(r.Context(), id, !course.IsPublished); err != nil {
		jsonError(w, "failed to toggle publish", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusOK, map[string]bool{"is_published": !course.IsPublished})
}
