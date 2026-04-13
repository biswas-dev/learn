package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	gowiki "github.com/anchoo2kewl/go-wiki"
	"github.com/biswas-dev/learn/internal/config"
	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
	"github.com/biswas-dev/learn/internal/version"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func NewRouter(s store.Store, cfg *config.Config, wiki *gowiki.Wiki, drawHandler http.Handler) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(middleware.Compress(5))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	authH := &AuthHandler{store: s, jwtSecret: cfg.JWTSecret}
	courseH := &CourseHandler{store: s}
	sectionH := &SectionHandler{store: s}
	pageH := &PageHandler{store: s, wiki: wiki}
	commentH := &CommentHandler{store: s}
	importH := &ImportHandler{store: s}
	adminH := &AdminHandler{store: s, port: cfg.Port}
	progressH := &ProgressHandler{store: s}
	apikeyH := &APIKeyHandler{store: s}

	// Health + version
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		jsonResp(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	r.Get("/api/version", func(w http.ResponseWriter, r *http.Request) {
		jsonResp(w, http.StatusOK, version.GetFull(cfg.Port))
	})

	// Public auth routes
	r.Post("/api/auth/signup", authH.Signup)
	r.Post("/api/auth/login", authH.Login)

	// Public course browsing (with optional auth for protected course access)
	r.Group(func(r chi.Router) {
		r.Use(OptionalAuth(cfg.JWTSecret, s))
		r.Get("/api/courses", courseH.List)
		r.Get("/api/courses/{courseSlug}", courseH.GetBySlug)
		r.Get("/api/courses/{courseSlug}/sections/{sectionSlug}/pages/{pageSlug}", pageH.GetPageContent)
	})

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(JWTAuth(cfg.JWTSecret, s))

		r.Get("/api/me", authH.Me)
		r.Post("/api/me/password", authH.ChangePassword)

		// API Keys
		r.Get("/api/api-keys", apikeyH.List)
		r.Post("/api/api-keys", apikeyH.Create)
		r.Delete("/api/api-keys/{keyId}", apikeyH.Delete)

		// Wiki preview (editor+)
		r.Group(func(r chi.Router) {
			r.Use(RequireRole(models.RoleEditor))
			r.Post("/api/wiki/preview", pageH.WikiPreview)
		})

		// Course management (editor+)
		r.Group(func(r chi.Router) {
			r.Use(RequireRole(models.RoleEditor))
			r.Post("/api/courses", courseH.Create)
			r.Put("/api/courses/{courseId}", courseH.Update)
			r.Post("/api/courses/{courseId}/publish", courseH.Publish)

			r.Post("/api/courses/{courseId}/sections", sectionH.Create)
			r.Put("/api/sections/{sectionId}", sectionH.Update)
			r.Delete("/api/sections/{sectionId}", sectionH.Delete)

			r.Post("/api/sections/{sectionId}/pages", pageH.Create)
			r.Put("/api/pages/{pageId}", pageH.Update)
			r.Delete("/api/pages/{pageId}", pageH.Delete)
			r.Put("/api/pages/{pageId}/content", pageH.UpdateContent)
			r.Get("/api/pages/{pageId}/versions", pageH.ListVersions)
			r.Post("/api/pages/{pageId}/versions/{versionNum}/restore", pageH.RestoreVersion)

			r.Post("/api/import/course", importH.ImportCourse)
		})

		// Course deletion (admin only)
		r.Group(func(r chi.Router) {
			r.Use(RequireRole(models.RoleAdmin))
			r.Delete("/api/courses/{courseId}", courseH.Delete)
		})

		// Comments (commenter+)
		r.Group(func(r chi.Router) {
			r.Use(RequireRole(models.RoleCommenter))
			r.Get("/api/pages/{pageId}/comments", commentH.List)
			r.Post("/api/pages/{pageId}/comments", commentH.Create)
			r.Delete("/api/comments/{commentId}", commentH.Delete)
		})

		// Progress (any authenticated)
		r.Post("/api/pages/{pageId}/complete", progressH.MarkComplete)
		r.Get("/api/courses/{courseId}/progress", progressH.GetCourseProgress)

		// Admin
		r.Group(func(r chi.Router) {
			r.Use(RequireRole(models.RoleAdmin))
			r.Get("/api/admin/users", adminH.ListUsers)
			r.Patch("/api/admin/users/{userId}/role", adminH.UpdateUserRole)
			r.Get("/api/admin/system-info", adminH.SystemInfo)
		})
	})

	// Serve uploaded images (public)
	imagesDir := filepath.Join(cfg.DrawDataDir, "..", "images")
	os.MkdirAll(imagesDir, 0755)
	r.Handle("/images/*", http.StripPrefix("/images/", http.FileServer(http.Dir(imagesDir))))

	// go-draw routes
	if drawHandler != nil {
		r.Group(func(r chi.Router) {
			r.Use(OptionalAuth(cfg.JWTSecret, s))
			r.Handle("/draw/*", drawAuthMiddleware(s, drawHandler))
		})
	}

	// SPA fallback
	serveSPA(r, cfg.FrontendDist)

	return r
}

// drawAuthMiddleware wraps go-draw handler: admin/editor get full access, others read-only.
func drawAuthMiddleware(s store.Store, handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := UserFromCtx(r.Context())
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			if user == nil || user.Role.Level() < models.RoleEditor.Level() {
				http.Error(w, `{"error":"insufficient permissions"}`, http.StatusForbidden)
				return
			}
		}
		handler.ServeHTTP(w, r)
	})
}

func serveSPA(r chi.Router, distPath string) {
	if distPath == "" {
		return
	}
	absPath, err := filepath.Abs(distPath)
	if err != nil {
		return
	}
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return
	}

	fileServer := http.FileServer(http.Dir(absPath))

	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/draw/") {
			http.NotFound(w, r)
			return
		}

		path := filepath.Join(absPath, r.URL.Path)
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			if strings.HasPrefix(r.URL.Path, "/build/") || strings.HasPrefix(r.URL.Path, "/assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else {
				w.Header().Set("Cache-Control", "no-cache, must-revalidate")
			}
			fileServer.ServeHTTP(w, r)
			return
		}

		candidate := filepath.Join(absPath, r.URL.Path, "index.html")
		if _, err := os.Stat(candidate); err == nil {
			w.Header().Set("Cache-Control", "no-cache, must-revalidate")
			http.ServeFile(w, r, candidate)
			return
		}

		if resolved := resolveDynamicRoute(absPath, r.URL.Path); resolved != "" {
			w.Header().Set("Cache-Control", "no-cache, must-revalidate")
			http.ServeFile(w, r, resolved)
			return
		}

		indexPath := filepath.Join(absPath, "index.html")
		if _, err := os.Stat(indexPath); err == nil {
			w.Header().Set("Cache-Control", "no-cache, must-revalidate")
			http.ServeFile(w, r, indexPath)
			return
		}

		http.NotFound(w, r)
	})
}

func resolveDynamicRoute(absPath, urlPath string) string {
	parts := strings.Split(strings.Trim(urlPath, "/"), "/")

	changed := false
	for i, p := range parts {
		if _, err := strconv.Atoi(p); err == nil {
			parts[i] = "_"
			changed = true
		}
	}
	if changed {
		candidate := filepath.Join(absPath, filepath.Join(parts...), "index.html")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}

	parts = strings.Split(strings.Trim(urlPath, "/"), "/")
	for i := range parts {
		literalDir := filepath.Join(absPath, filepath.Join(parts[:i+1]...))
		if _, err := os.Stat(literalDir); err == nil {
			continue
		}
		original := parts[i]
		parts[i] = "_"
		candidate := filepath.Join(absPath, filepath.Join(parts...), "index.html")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
		parts[i] = original
	}
	return ""
}

func jsonResp(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, msg string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
