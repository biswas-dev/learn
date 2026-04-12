package api

import (
	"context"
	"net/http"
	"strings"

	"github.com/biswas-dev/learn/internal/auth"
	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
)

type contextKey string

const (
	ctxUserID contextKey = "user_id"
	ctxUser   contextKey = "user"
)

func UserIDFromCtx(ctx context.Context) int64 {
	if v, ok := ctx.Value(ctxUserID).(int64); ok {
		return v
	}
	return 0
}

func UserFromCtx(ctx context.Context) *models.User {
	if v, ok := ctx.Value(ctxUser).(*models.User); ok {
		return v
	}
	return nil
}

// JWTAuth validates JWT tokens and sets user context.
func JWTAuth(secret string, s store.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			tokenStr := ""
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenStr = authHeader[7:]
			}
			if tokenStr == "" {
				tokenStr = r.URL.Query().Get("token")
			}
			if tokenStr == "" {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			claims, err := auth.ValidateToken(tokenStr, secret)
			if err != nil {
				http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
				return
			}

			user, err := s.GetUserByID(r.Context(), claims.UserID)
			if err != nil || user == nil {
				http.Error(w, `{"error":"user not found"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ctxUserID, user.ID)
			ctx = context.WithValue(ctx, ctxUser, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalAuth sets user context if a valid token is present, but does not block.
func OptionalAuth(secret string, s store.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			tokenStr := ""
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenStr = authHeader[7:]
			}
			if tokenStr == "" {
				next.ServeHTTP(w, r)
				return
			}

			claims, err := auth.ValidateToken(tokenStr, secret)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			user, err := s.GetUserByID(r.Context(), claims.UserID)
			if err != nil || user == nil {
				next.ServeHTTP(w, r)
				return
			}

			ctx := context.WithValue(r.Context(), ctxUserID, user.ID)
			ctx = context.WithValue(ctx, ctxUser, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole ensures the user has at least the given role level.
func RequireRole(minRole models.UserRole) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := UserFromCtx(r.Context())
			if user == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			if user.Role.Level() < minRole.Level() {
				http.Error(w, `{"error":"insufficient permissions"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
