package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
	"github.com/biswas-dev/learn/internal/version"
	"github.com/go-chi/chi/v5"
)

type AdminHandler struct {
	store    store.Store
	port     int
	imageDir string
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

func (h *AdminHandler) ListUsersWithAccess(w http.ResponseWriter, r *http.Request) {
	users, err := h.store.ListUsers(r.Context())
	if err != nil {
		jsonError(w, "failed to list users", http.StatusInternalServerError)
		return
	}
	if users == nil {
		users = []models.User{}
	}
	// Enrich each user with their access tags
	for i := range users {
		tags, _ := h.store.GetUserAccessTags(r.Context(), users[i].ID)
		users[i].AccessTags = tags
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

func (h *AdminHandler) UpdateUserTagAccess(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "userId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid user id", http.StatusBadRequest)
		return
	}

	var req struct {
		TagIDs []int64 `json:"tag_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.store.SetUserTagAccess(r.Context(), id, req.TagIDs); err != nil {
		jsonError(w, "failed to update tag access", http.StatusInternalServerError)
		return
	}

	tags, _ := h.store.GetUserAccessTags(r.Context(), id)
	jsonResp(w, http.StatusOK, map[string]any{"access_tags": tags})
}

func (h *AdminHandler) SystemInfo(w http.ResponseWriter, r *http.Request) {
	stats, err := h.store.GetStorageStats(r.Context())
	if err != nil {
		jsonError(w, "failed to get stats", http.StatusInternalServerError)
		return
	}

	// Compute image directory size
	if h.imageDir != "" {
		var imgSize int64
		var imgCount int
		filepath.Walk(h.imageDir, func(_ string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() {
				return nil
			}
			imgSize += info.Size()
			imgCount++
			return nil
		})
		stats.ImageSize = imgSize
		stats.ImageCount = imgCount
		stats.ImageSizeH = humanSizeAPI(imgSize)
	}

	stats.TotalSize = stats.DBSize + stats.ImageSize
	stats.TotalSizeH = humanSizeAPI(stats.TotalSize)

	jsonResp(w, http.StatusOK, map[string]any{
		"version": version.GetFull(h.port),
		"storage": stats,
	})
}

func humanSizeAPI(b int64) string {
	const (
		kb = 1024
		mb = kb * 1024
		gb = mb * 1024
	)
	switch {
	case b >= gb:
		return fmt.Sprintf("%.1f GB", float64(b)/float64(gb))
	case b >= mb:
		return fmt.Sprintf("%.1f MB", float64(b)/float64(mb))
	case b >= kb:
		return fmt.Sprintf("%.1f KB", float64(b)/float64(kb))
	default:
		return fmt.Sprintf("%d B", b)
	}
}
