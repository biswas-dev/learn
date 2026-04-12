package api

import (
	"net/http"
	"strconv"

	"github.com/biswas-dev/learn/internal/store"
	"github.com/go-chi/chi/v5"
)

type ProgressHandler struct {
	store store.Store
}

func (h *ProgressHandler) MarkComplete(w http.ResponseWriter, r *http.Request) {
	pageID, err := strconv.ParseInt(chi.URLParam(r, "pageId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid page id", http.StatusBadRequest)
		return
	}
	userID := UserIDFromCtx(r.Context())
	if err := h.store.MarkPageComplete(r.Context(), userID, pageID); err != nil {
		jsonError(w, "failed to mark complete", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusOK, map[string]string{"message": "marked complete"})
}

func (h *ProgressHandler) GetCourseProgress(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid course id", http.StatusBadRequest)
		return
	}
	userID := UserIDFromCtx(r.Context())
	progress, err := h.store.GetCourseProgress(r.Context(), userID, courseID)
	if err != nil {
		jsonError(w, "failed to get progress", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusOK, progress)
}
