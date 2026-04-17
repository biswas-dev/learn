package api

import (
	"net/http"

	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
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
