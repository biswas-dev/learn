package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/biswas-dev/learn/internal/auth"
	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
)

type AuthHandler struct {
	store     store.Store
	jwtSecret string
}

func (h *AuthHandler) Signup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Email == "" || req.Password == "" {
		jsonError(w, "email and password are required", http.StatusBadRequest)
		return
	}

	if err := auth.ValidateStrength(req.Password); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	existing, _ := h.store.GetUserByEmail(r.Context(), req.Email)
	if existing != nil {
		jsonError(w, "email already registered", http.StatusConflict)
		return
	}

	hash, err := auth.Hash(req.Password)
	if err != nil {
		jsonError(w, "failed to hash password", http.StatusInternalServerError)
		return
	}

	user := &models.User{
		Email:        req.Email,
		PasswordHash: hash,
		DisplayName:  req.DisplayName,
		Role:         models.RoleViewer,
	}
	if err := h.store.CreateUser(r.Context(), user); err != nil {
		jsonError(w, "failed to create user", http.StatusInternalServerError)
		return
	}

	token, err := auth.GenerateToken(user.ID, h.jwtSecret, 7*24*time.Hour)
	if err != nil {
		jsonError(w, "failed to generate token", http.StatusInternalServerError)
		return
	}

	jsonResp(w, http.StatusCreated, map[string]any{
		"token": token,
		"user": map[string]any{
			"id":           user.ID,
			"email":        user.Email,
			"display_name": user.DisplayName,
			"role":         user.Role,
		},
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	user, err := h.store.GetUserByEmail(r.Context(), req.Email)
	if err != nil || user == nil {
		jsonError(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	if !auth.Verify(req.Password, user.PasswordHash) {
		jsonError(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	token, err := auth.GenerateToken(user.ID, h.jwtSecret, 7*24*time.Hour)
	if err != nil {
		jsonError(w, "failed to generate token", http.StatusInternalServerError)
		return
	}

	jsonResp(w, http.StatusOK, map[string]any{
		"token": token,
		"user": map[string]any{
			"id":           user.ID,
			"email":        user.Email,
			"display_name": user.DisplayName,
			"role":         user.Role,
		},
	})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	user := UserFromCtx(r.Context())
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	jsonResp(w, http.StatusOK, map[string]any{
		"id":           user.ID,
		"email":        user.Email,
		"display_name": user.DisplayName,
		"role":         user.Role,
		"created_at":   user.CreatedAt,
	})
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	user := UserFromCtx(r.Context())
	if user == nil {
		jsonError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if !auth.Verify(req.CurrentPassword, user.PasswordHash) {
		jsonError(w, "current password is incorrect", http.StatusUnauthorized)
		return
	}

	if err := auth.ValidateStrength(req.NewPassword); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	hash, err := auth.Hash(req.NewPassword)
	if err != nil {
		jsonError(w, "failed to hash password", http.StatusInternalServerError)
		return
	}

	user.PasswordHash = hash
	if err := h.store.UpdateUser(r.Context(), user); err != nil {
		jsonError(w, "failed to update password", http.StatusInternalServerError)
		return
	}

	jsonResp(w, http.StatusOK, map[string]string{"message": "password updated"})
}
