package api

import (
	"net/http"

	"github.com/biswas-dev/learn/internal/store"
)

type DashboardHandler struct {
	store store.Store
}

func (h *DashboardHandler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	userID := UserIDFromCtx(r.Context())
	if userID == 0 {
		jsonError(w, "authentication required", http.StatusUnauthorized)
		return
	}

	dashboard, err := h.store.GetDashboard(r.Context(), userID)
	if err != nil {
		jsonError(w, "failed to load dashboard", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Cache-Control", "private, max-age=30")
	jsonResp(w, http.StatusOK, dashboard)
}
