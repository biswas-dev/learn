package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
	"github.com/biswas-dev/learn/internal/version"
	"github.com/go-chi/chi/v5"
)

type AdminHandler struct {
	store store.Store
	port  int
}

func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.store.ListUsers(r.Context())
	if err != nil {
		jsonError(w, "failed to list users", http.StatusInternalServerError)
		return
	}
	if users == nil {
		users = []models.User{}
	}
	jsonResp(w, http.StatusOK, users)
}

func (h *AdminHandler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "userId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid user id", http.StatusBadRequest)
		return
	}

	var req struct {
		Role models.UserRole `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Role.Level() == 0 {
		jsonError(w, "invalid role", http.StatusBadRequest)
		return
	}

	if err := h.store.UpdateUserRole(r.Context(), id, req.Role); err != nil {
		jsonError(w, "failed to update role", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusOK, map[string]string{"message": "role updated"})
}

func (h *AdminHandler) SystemInfo(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, http.StatusOK, version.GetFull(h.port))
}
