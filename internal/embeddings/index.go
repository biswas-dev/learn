package embeddings

import (
	"encoding/binary"
	"math"
	"sort"
	"sync"
)

// SearchResult is a single vector search hit.
type SearchResult struct {
	PageID     int64
	SectionID  int64
	CourseID   int64
	CourseSlug string
	SectSlug   string
	PageSlug   string
	CourseTitle string
	SectTitle   string
	PageTitle   string
	Snippet    string
	Score      float64 // cosine similarity (0..1)
}

// entry is a single indexed page embedding.
type entry struct {
	pageID     int64
	sectionID  int64
	courseID   int64
	courseSlug string
	sectSlug   string
	pageSlug   string
	courseTitle string
	sectTitle   string
	pageTitle   string
	snippet    string
	vec        []float32
}

// Index is an in-memory vector index for fast cosine similarity search.
type Index struct {
	mu      sync.RWMutex
	entries []entry
}

// NewIndex creates an empty index.
func NewIndex() *Index {
	return &Index{}
}

// Len returns the number of indexed entries.
func (idx *Index) Len() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return len(idx.entries)
}

// Clear removes all entries.
func (idx *Index) Clear() {
	idx.mu.Lock()
	defer idx.mu.Unlock()
	idx.entries = nil
}

// Add inserts a page embedding into the index.
func (idx *Index) Add(pageID, sectionID, courseID int64,
	courseSlug, sectSlug, pageSlug, courseTitle, sectTitle, pageTitle, snippet string,
	vec []float32) {
	idx.mu.Lock()
	defer idx.mu.Unlock()
	// Replace if pageID already exists
	for i := range idx.entries {
		if idx.entries[i].pageID == pageID {
			idx.entries[i] = entry{pageID, sectionID, courseID, courseSlug, sectSlug, pageSlug, courseTitle, sectTitle, pageTitle, snippet, vec}
			return
		}
	}
	idx.entries = append(idx.entries, entry{pageID, sectionID, courseID, courseSlug, sectSlug, pageSlug, courseTitle, sectTitle, pageTitle, snippet, vec})
}

// Search returns the top-k most similar entries to the query vector.
func (idx *Index) Search(query []float32, k int) []SearchResult {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if len(idx.entries) == 0 || len(query) == 0 {
		return nil
	}

	type scored struct {
		idx   int
		score float64
	}
	scores := make([]scored, len(idx.entries))
	for i, e := range idx.entries {
		scores[i] = scored{i, cosineSimilarity(query, e.vec)}
	}
	sort.Slice(scores, func(a, b int) bool { return scores[a].score > scores[b].score })

	if k > len(scores) {
		k = len(scores)
	}
	results := make([]SearchResult, k)
	for i := 0; i < k; i++ {
		e := idx.entries[scores[i].idx]
		results[i] = SearchResult{
			PageID:      e.pageID,
			SectionID:   e.sectionID,
			CourseID:    e.courseID,
			CourseSlug:  e.courseSlug,
			SectSlug:    e.sectSlug,
			PageSlug:    e.pageSlug,
			CourseTitle: e.courseTitle,
			SectTitle:   e.sectTitle,
			PageTitle:   e.pageTitle,
			Snippet:     e.snippet,
			Score:       scores[i].score,
		}
	}
	return results
}

func cosineSimilarity(a, b []float32) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}
	var dot, normA, normB float64
	for i := range a {
		ai, bi := float64(a[i]), float64(b[i])
		dot += ai * bi
		normA += ai * ai
		normB += bi * bi
	}
	denom := math.Sqrt(normA) * math.Sqrt(normB)
	if denom == 0 {
		return 0
	}
	return dot / denom
}

// EncodeVec serializes a float32 slice to a binary blob for SQLite storage.
func EncodeVec(v []float32) []byte {
	buf := make([]byte, len(v)*4)
	for i, f := range v {
		binary.LittleEndian.PutUint32(buf[i*4:], math.Float32bits(f))
	}
	return buf
}

// DecodeVec deserializes a binary blob back to a float32 slice.
func DecodeVec(b []byte) []float32 {
	if len(b)%4 != 0 {
		return nil
	}
	v := make([]float32, len(b)/4)
	for i := range v {
		v[i] = math.Float32frombits(binary.LittleEndian.Uint32(b[i*4:]))
	}
	return v
}
