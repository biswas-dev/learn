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
