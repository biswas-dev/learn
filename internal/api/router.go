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
	"github.com/biswas-dev/learn/internal/images"
	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
	"github.com/biswas-dev/learn/internal/version"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func NewRouter(s store.Store, cfg *config.Config, wiki *gowiki.Wiki, drawHandler http.Handler, imgStore images.Store) http.Handler {
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
	importH := &ImportHandler{store: s, imgStore: imgStore}
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
			r.Post("/api/import/bulk", importH.BulkImport)
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
	r.Handle("/images/*", imgStore.Handler("/images/"))

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

		// Don't serve HTML fallback for data/asset requests
		if strings.HasSuffix(r.URL.Path, ".json") || strings.HasSuffix(r.URL.Path, ".xml") {
			http.NotFound(w, r)
			return
		}

		// Last resort fallback to root index.html
		indexPath := filepath.Join(absPath, "index.html")
		if _, err := os.Stat(indexPath); err == nil {
			w.Header().Set("Cache-Control", "no-cache, must-revalidate")
			http.ServeFile(w, r, indexPath)
			return
		}

		http.NotFound(w, r)
	})
}

// buildSPAShell extracts CSS/JS links from the SSG index.html and creates
// a minimal HTML page that Qwik will fully render client-side.
func buildSPAShell(ssgHTML string) string {
	var links, scripts strings.Builder

	// Extract <link rel="stylesheet" ...> and <link rel="modulepreload" ...>
	for _, tag := range extractTags(ssgHTML, "<link ", ">") {
		if strings.Contains(tag, "stylesheet") || strings.Contains(tag, "modulepreload") {
			links.WriteString(tag)
			links.WriteString("\n")
		}
	}

	// Extract <script ...>...</script> tags
	for _, tag := range extractTags(ssgHTML, "<script", "</script>") {
		scripts.WriteString(tag)
		scripts.WriteString("</script>\n")
	}

	// Extract <style> tags
	for _, tag := range extractTags(ssgHTML, "<style", "</style>") {
		links.WriteString(tag)
		links.WriteString("</style>\n")
	}

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Learn — Course Platform</title>
` + links.String() + scripts.String() + `
</head>
<body class="bg-surface text-text min-h-screen antialiased">
<div id="app"></div>
<script type="module">
import { render } from '/build/q-CprRSmAP.js';
</script>
</body>
</html>`
}

func extractTags(html, startTag, endTag string) []string {
	var tags []string
	rest := html
	for {
		start := strings.Index(rest, startTag)
		if start == -1 {
			break
		}
		end := strings.Index(rest[start:], endTag)
		if end == -1 {
			break
		}
		end += start + len(endTag)
		tags = append(tags, rest[start:end])
		rest = rest[end:]
	}
	return tags
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
		// Segment doesn't exist literally — try wildcard placeholder
		parts[i] = "_"
		wildcardDir := filepath.Join(absPath, filepath.Join(parts[:i+1]...))
		if _, err := os.Stat(wildcardDir); os.IsNotExist(err) {
			return "" // no matching route structure
		}
	}
	candidate := filepath.Join(absPath, filepath.Join(parts...), "index.html")
	if _, err := os.Stat(candidate); err == nil {
		return candidate
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
