package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// compressedImageServer serves images from disk, preferring pre-compressed
// .svg.gz files when available and the client supports gzip.
func compressedImageServer(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only try .gz for SVG files
		if strings.HasSuffix(r.URL.Path, ".svg") {
			gzPath := filepath.Join(dir, r.URL.Path+".gz")
			if _, err := os.Stat(gzPath); err == nil {
				// Check if client accepts gzip
				if strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
					w.Header().Set("Content-Encoding", "gzip")
					w.Header().Set("Content-Type", "image/svg+xml")
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
					http.ServeFile(w, r, gzPath)
					return
				}
			}
		}

		// Fall through to normal file serving for non-SVG or no gzip support
		fs.ServeHTTP(w, r)
	})
}
