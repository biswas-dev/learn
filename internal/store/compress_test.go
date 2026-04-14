package store

import (
	"strings"
	"testing"
)

func TestCompressDecompressRoundtrip(t *testing.T) {
	cases := []string{
		"",
		"short",
		"<h1>Hello World</h1><p>This is a test paragraph with some content.</p>",
		strings.Repeat("<p>Repeated HTML content for compression testing.</p>\n", 100),
	}
	for _, original := range cases {
		compressed := CompressContent(original)
		decompressed, err := DecompressContent(compressed)
		if err != nil {
			t.Fatalf("DecompressContent error: %v", err)
		}
		if decompressed != original {
			t.Fatalf("roundtrip failed: got %d bytes, want %d bytes", len(decompressed), len(original))
		}
	}
}

func TestCompressActuallyShrinks(t *testing.T) {
	large := strings.Repeat("<div class=\"edu-image\"><img src=\"/images/test.png\" alt=\"test\" /></div>\n", 100)
	compressed := CompressContent(large)
	if !strings.HasPrefix(compressed, compressPrefix) {
		t.Fatal("large content should be compressed")
	}
	if len(compressed) >= len(large) {
		t.Fatalf("compressed (%d) should be smaller than original (%d)", len(compressed), len(large))
	}
}

func TestDecompressUncompressedPassthrough(t *testing.T) {
	raw := "<h1>Not compressed</h1>"
	result, err := DecompressContent(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != raw {
		t.Fatal("uncompressed content should pass through unchanged")
	}
}

func TestCompressSkipsSmallContent(t *testing.T) {
	small := "hi"
	compressed := CompressContent(small)
	if strings.HasPrefix(compressed, compressPrefix) {
		t.Fatal("small content should not be compressed (overhead exceeds savings)")
	}
	if compressed != small {
		t.Fatal("small content should be returned unchanged")
	}
}
