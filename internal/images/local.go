package images

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// LocalStore serves images from the local filesystem.
type LocalStore struct {
	dir string
}

func NewLocalStore(dir string) (*LocalStore, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	return &LocalStore{dir: dir}, nil
}

func (s *LocalStore) Save(filename string, data io.Reader) error {
	f, err := os.Create(filepath.Join(s.dir, filename))
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, data)
	return err
}

func (s *LocalStore) Open(filename string) (io.ReadCloser, error) {
	return os.Open(filepath.Join(s.dir, filename))
}

func (s *LocalStore) Exists(filename string) bool {
	_, err := os.Stat(filepath.Join(s.dir, filename))
	return err == nil
}

func (s *LocalStore) Delete(filename string) error {
	return os.Remove(filepath.Join(s.dir, filename))
}

func (s *LocalStore) List() ([]string, error) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return nil, err
	}
	var names []string
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, e.Name())
		}
	}
	return names, nil
}

func (s *LocalStore) Handler(prefix string) http.Handler {
	return http.StripPrefix(prefix, compressedImageServer(s.dir))
}

// compressedImageServer serves images, preferring .svg.gz when available.
func compressedImageServer(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, ".svg") {
			gzPath := filepath.Join(dir, r.URL.Path+".gz")
			if _, err := os.Stat(gzPath); err == nil {
				if strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
					w.Header().Set("Content-Encoding", "gzip")
					w.Header().Set("Content-Type", "image/svg+xml")
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
					http.ServeFile(w, r, gzPath)
					return
				}
			}
		}
		fs.ServeHTTP(w, r)
	})
}
