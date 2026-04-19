package api

import (
	"net/http"

	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
)

type DashboardHandler struct {
	store store.Store
}

func (h *DashboardHandler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	user := UserFromCtx(r.Context())
	if user == nil {
		jsonError(w, "authentication required", http.StatusUnauthorized)
		return
	}

	isAdmin := user.Role == models.RoleAdmin
	dashboard, err := h.store.GetDashboard(r.Context(), user.ID, isAdmin)
	if err != nil {
		jsonError(w, "failed to load dashboard", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Cache-Control", "private, max-age=30")
	jsonResp(w, http.StatusOK, dashboard)
}
