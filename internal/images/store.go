package images

import (
	"io"
	"net/http"
)

// Store abstracts image storage (local filesystem or S3).
type Store interface {
	// Save stores an image. filename includes extension (e.g. "abc123.svg.gz").
	Save(filename string, data io.Reader) error
	// Open returns a reader for the image. Caller must close it.
	Open(filename string) (io.ReadCloser, error)
	// Exists checks if an image exists.
	Exists(filename string) bool
	// Delete removes an image.
	Delete(filename string) error
	// Handler returns an http.Handler that serves images at the given prefix.
	Handler(prefix string) http.Handler
	// List returns all filenames in the store.
	List() ([]string, error)
}
