package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
	"github.com/go-chi/chi/v5"
)

type CommentHandler struct {
	store store.Store
}

func (h *CommentHandler) List(w http.ResponseWriter, r *http.Request) {
	pageID, err := strconv.ParseInt(chi.URLParam(r, "pageId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid page id", http.StatusBadRequest)
		return
	}
	comments, err := h.store.ListComments(r.Context(), pageID)
	if err != nil {
		jsonError(w, "failed to list comments", http.StatusInternalServerError)
		return
	}
	if comments == nil {
		comments = []models.Comment{}
	}
	jsonResp(w, http.StatusOK, comments)
}

func (h *CommentHandler) Create(w http.ResponseWriter, r *http.Request) {
	pageID, err := strconv.ParseInt(chi.URLParam(r, "pageId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid page id", http.StatusBadRequest)
		return
	}

	user := UserFromCtx(r.Context())
	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Content == "" {
		jsonError(w, "content is required", http.StatusBadRequest)
		return
	}

	comment := &models.Comment{
		PageID:  pageID,
		UserID:  user.ID,
		Content: req.Content,
	}
	if err := h.store.CreateComment(r.Context(), comment); err != nil {
		jsonError(w, "failed to create comment", http.StatusInternalServerError)
		return
	}
	comment.AuthorName = user.DisplayName
	jsonResp(w, http.StatusCreated, comment)
}

func (h *CommentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "commentId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid comment id", http.StatusBadRequest)
		return
	}

	user := UserFromCtx(r.Context())
	comment, err := h.store.GetCommentByID(r.Context(), id)
	if err != nil || comment == nil {
		jsonError(w, "comment not found", http.StatusNotFound)
		return
	}

	// Only comment author or admin can delete
	if comment.UserID != user.ID && user.Role != models.RoleAdmin {
		jsonError(w, "insufficient permissions", http.StatusForbidden)
		return
	}

	if err := h.store.DeleteComment(r.Context(), id); err != nil {
		jsonError(w, "failed to delete comment", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}
