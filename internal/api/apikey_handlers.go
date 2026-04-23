package api

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
	"github.com/go-chi/chi/v5"
)

type APIKeyHandler struct {
	store store.Store
}

func (h *APIKeyHandler) List(w http.ResponseWriter, r *http.Request) {
	user := UserFromCtx(r.Context())
	keys, err := h.store.ListAPIKeys(r.Context(), user.ID)
	if err != nil {
		jsonError(w, "failed to list api keys", http.StatusInternalServerError)
		return
	}
	if keys == nil {
		keys = []models.APIKey{}
	}
	jsonResp(w, http.StatusOK, keys)
}

func (h *APIKeyHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := UserFromCtx(r.Context())
	var req struct {
		Name      string `json:"name"`
		ExpiresIn string `json:"expires_in"` // "30d", "90d", "1y", "never", or "" (= never)
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		req.Name = "default"
	}

	// Parse expiration
	var expiresAt string
	if req.ExpiresIn != "" && req.ExpiresIn != "never" {
		dur, err := parseDuration(req.ExpiresIn)
		if err != nil {
			jsonError(w, "invalid expires_in: use '7d', '30d', '90d', '1y', or 'never'", http.StatusBadRequest)
			return
		}
		expiresAt = time.Now().Add(dur).UTC().Format("2006-01-02T15:04:05Z")
	}

	// Generate random key
	rawBytes := make([]byte, 32)
	if _, err := rand.Read(rawBytes); err != nil {
		jsonError(w, "failed to generate key", http.StatusInternalServerError)
		return
	}
	rawKey := "lrn_" + hex.EncodeToString(rawBytes)
	keyHash := HashAPIKey(rawKey)

	key := &models.APIKey{
		UserID:    user.ID,
		Name:      req.Name,
		KeyHash:   keyHash,
		KeyPrefix: rawKey[:12],
		ExpiresAt: expiresAt,
	}
	if err := h.store.CreateAPIKey(r.Context(), key); err != nil {
		jsonError(w, "failed to create api key", http.StatusInternalServerError)
		return
	}

	// Return the raw key — this is the ONLY time it's visible
	resp := map[string]any{
		"id":         key.ID,
		"name":       key.Name,
		"key":        rawKey,
		"key_prefix": key.KeyPrefix,
		"created_at": key.CreatedAt,
	}
	if expiresAt != "" {
		resp["expires_at"] = expiresAt
	}
	jsonResp(w, http.StatusCreated, resp)
}

func (h *APIKeyHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "keyId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid key id", http.StatusBadRequest)
		return
	}
	user := UserFromCtx(r.Context())
	if err := h.store.DeleteAPIKey(r.Context(), id, user.ID); err != nil {
		jsonError(w, "failed to delete api key", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

func HashAPIKey(rawKey string) string {
	h := sha256.Sum256([]byte(rawKey))
	return fmt.Sprintf("%x", h)
}

// parseDuration parses human-friendly durations like "7d", "30d", "90d", "1y".
func parseDuration(s string) (time.Duration, error) {
	if len(s) < 2 {
		return 0, fmt.Errorf("too short")
	}
	unit := s[len(s)-1]
	numStr := s[:len(s)-1]
	n, err := strconv.Atoi(numStr)
	if err != nil || n <= 0 {
		return 0, fmt.Errorf("invalid number: %s", numStr)
	}
	switch unit {
	case 'd':
		return time.Duration(n) * 24 * time.Hour, nil
	case 'w':
		return time.Duration(n) * 7 * 24 * time.Hour, nil
	case 'm':
		return time.Duration(n) * 30 * 24 * time.Hour, nil
	case 'y':
		return time.Duration(n) * 365 * 24 * time.Hour, nil
	case 'h':
		return time.Duration(n) * time.Hour, nil
	default:
		return 0, fmt.Errorf("unknown unit: %c (use d/w/m/y/h)", unit)
	}
}
