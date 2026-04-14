package store

import (
	"bytes"
	"compress/zlib"
	"encoding/base64"
	"io"
	"strings"
)

const compressPrefix = "zlib:"

// CompressContent compresses a string for storage.
// Returns the original string if compression doesn't save space.
func CompressContent(s string) string {
	if s == "" {
		return s
	}
	var buf bytes.Buffer
	w, _ := zlib.NewWriterLevel(&buf, zlib.BestCompression)
	w.Write([]byte(s))
	w.Close()
	encoded := compressPrefix + base64.StdEncoding.EncodeToString(buf.Bytes())
	if len(encoded) >= len(s) {
		return s
	}
	return encoded
}

// DecompressContent transparently decompresses content.
// If content has no compression prefix, returns as-is (backward compatible).
func DecompressContent(s string) (string, error) {
	if !strings.HasPrefix(s, compressPrefix) {
		return s, nil
	}
	data, err := base64.StdEncoding.DecodeString(s[len(compressPrefix):])
	if err != nil {
		return "", err
	}
	r, err := zlib.NewReader(bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	defer r.Close()
	out, err := io.ReadAll(r)
	if err != nil {
		return "", err
	}
	return string(out), nil
}
