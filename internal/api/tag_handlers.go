package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
	"github.com/go-chi/chi/v5"
)

type TagHandler struct {
	store store.Store
}

func (h *TagHandler) List(w http.ResponseWriter, r *http.Request) {
	tags, err := h.store.ListTagsWithCounts(r.Context())
	if err != nil {
		jsonError(w, "failed to list tags", http.StatusInternalServerError)
		return
	}
	if tags == nil {
		tags = []models.Tag{}
	}
	w.Header().Set("Cache-Control", "public, max-age=300")
	jsonResp(w, http.StatusOK, tags)
}

// AddCourseTags adds one or more tags to a course, creating tags that don't exist yet.
func (h *TagHandler) AddCourseTags(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid course id", http.StatusBadRequest)
		return
	}

	var req struct {
		Tags []struct {
			Name     string `json:"name"`
			Category string `json:"category"`
		} `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	for _, t := range req.Tags {
		slug := strings.ToLower(strings.TrimSpace(t.Name))
		slug = slugify(slug)
		tag, err := h.store.GetOrCreateTag(r.Context(), t.Name, slug, t.Category)
		if err != nil {
			jsonError(w, "failed to create tag", http.StatusInternalServerError)
			return
		}
		if err := h.store.AddCourseTag(r.Context(), courseID, tag.ID); err != nil {
			jsonError(w, "failed to add tag to course", http.StatusInternalServerError)
			return
		}
	}

	tags, _ := h.store.ListCourseTags(r.Context(), courseID)
	jsonResp(w, http.StatusOK, tags)
}
