package api

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

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
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		req.Name = "default"
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
	}
	if err := h.store.CreateAPIKey(r.Context(), key); err != nil {
		jsonError(w, "failed to create api key", http.StatusInternalServerError)
		return
	}

	// Return the raw key only once
	jsonResp(w, http.StatusCreated, map[string]any{
		"id":         key.ID,
		"name":       key.Name,
		"key":        rawKey,
		"key_prefix": key.KeyPrefix,
		"created_at": key.CreatedAt,
	})
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
