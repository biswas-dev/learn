package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
	"github.com/go-chi/chi/v5"
)

type SectionHandler struct {
	store store.Store
}

func (h *SectionHandler) Create(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid course id", http.StatusBadRequest)
		return
	}

	var req struct {
		Title     string `json:"title"`
		SortOrder *int   `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Title == "" {
		jsonError(w, "title is required", http.StatusBadRequest)
		return
	}

	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	section := &models.Section{
		CourseID:  courseID,
		Title:     req.Title,
		Slug:      slugify(req.Title),
		SortOrder: sortOrder,
	}
	if err := h.store.CreateSection(r.Context(), section); err != nil {
		jsonError(w, "failed to create section", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusCreated, section)
}

func (h *SectionHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "sectionId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid section id", http.StatusBadRequest)
		return
	}

	section, err := h.store.GetSectionByID(r.Context(), id)
	if err != nil || section == nil {
		jsonError(w, "section not found", http.StatusNotFound)
		return
	}

	var req struct {
		Title     string `json:"title"`
		SortOrder *int   `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Title != "" {
		section.Title = req.Title
		section.Slug = slugify(req.Title)
	}
	if req.SortOrder != nil {
		section.SortOrder = *req.SortOrder
	}

	if err := h.store.UpdateSection(r.Context(), section); err != nil {
		jsonError(w, "failed to update section", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusOK, section)
}

func (h *SectionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "sectionId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid section id", http.StatusBadRequest)
		return
	}
	if err := h.store.DeleteSection(r.Context(), id); err != nil {
		jsonError(w, "failed to delete section", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}
