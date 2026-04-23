package api

import (
	"context"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/biswas-dev/learn/internal/embeddings"
	"github.com/biswas-dev/learn/internal/store"
	"github.com/rs/zerolog/log"
)

// LoadEmbeddingsIndex loads stored embeddings from DB into the in-memory index at startup.
func LoadEmbeddingsIndex(s store.Store, idx *embeddings.Index) {
	h := &SemanticSearchHandler{store: s, index: idx}
	if err := h.LoadIndex(context.Background()); err != nil {
		log.Warn().Err(err).Msg("failed to load embeddings index from DB")
	}
}

type SemanticSearchHandler struct {
	store  store.Store
	client *embeddings.Client
	index  *embeddings.Index
}

type semanticResult struct {
	CourseTitle string  `json:"course_title"`
	PageTitle   string  `json:"page_title"`
	SectionTitle string `json:"section_title"`
	Snippet     string  `json:"snippet"`
	Score       float64 `json:"score"`
	URL         string  `json:"url"`
	CourseSlug  string  `json:"course_slug"`
}

var htmlTagRe = regexp.MustCompile(`<[^>]*>`)

func stripHTML(s string) string {
	return strings.TrimSpace(htmlTagRe.ReplaceAllString(s, " "))
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// Search handles GET /api/search/semantic?q=...&limit=10
func (h *SemanticSearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		jsonError(w, "q parameter required", http.StatusBadRequest)
		return
	}

	limit := 10
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 && l <= 50 {
		limit = l
	}

	if h.client == nil {
		jsonError(w, "semantic search not available (no Ollama)", http.StatusServiceUnavailable)
		return
	}
	if h.index.Len() == 0 {
		jsonError(w, "index is empty — run POST /api/search/reindex first", http.StatusServiceUnavailable)
		return
	}

	vec, err := h.client.Embed(query)
	if err != nil {
		log.Error().Err(err).Str("query", query).Msg("embed query failed")
		jsonError(w, "embedding failed", http.StatusInternalServerError)
		return
	}

	hits := h.index.Search(vec, limit)
	results := make([]semanticResult, len(hits))
	for i, hit := range hits {
		results[i] = semanticResult{
			CourseTitle:  hit.CourseTitle,
			PageTitle:    hit.PageTitle,
			SectionTitle: hit.SectTitle,
			Snippet:      hit.Snippet,
			Score:        hit.Score,
			URL:          "/courses/" + hit.CourseSlug + "/" + hit.SectSlug + "/" + hit.PageSlug,
			CourseSlug:   hit.CourseSlug,
		}
	}

	jsonResp(w, http.StatusOK, map[string]any{
		"query":   query,
		"results": results,
		"total":   len(results),
	})
}

// Reindex handles POST /api/search/reindex — rebuilds the entire vector index.
func (h *SemanticSearchHandler) Reindex(w http.ResponseWriter, r *http.Request) {
	if h.client == nil {
		jsonError(w, "semantic search not available (no Ollama)", http.StatusServiceUnavailable)
		return
	}

	go func() {
		if err := h.buildIndex(context.Background()); err != nil {
			log.Error().Err(err).Msg("reindex failed")
		}
	}()

	jsonResp(w, http.StatusAccepted, map[string]string{
		"status":  "accepted",
		"message": "re-indexing started in background",
	})
}

// Status handles GET /api/search/status
func (h *SemanticSearchHandler) Status(w http.ResponseWriter, r *http.Request) {
	jsonResp(w, http.StatusOK, map[string]any{
		"indexed_pages": h.index.Len(),
		"model":         h.client.Model(),
		"ollama_healthy": h.client.Healthy(),
	})
}

// buildIndex loads all pages, embeds them, and populates the in-memory index + DB.
func (h *SemanticSearchHandler) buildIndex(ctx context.Context) error {
	log.Info().Msg("semantic: starting full reindex")

	sqlDB := h.store.(*store.SQLiteStore).DB()

	// Get all published pages with course/section metadata
	rows, err := sqlDB.QueryContext(ctx, `
		SELECT p.id, p.section_id, c.id, c.slug, s.slug, p.slug,
		       c.title, s.title, p.title, p.content
		FROM pages p
		JOIN sections s ON p.section_id = s.id
		JOIN courses c ON s.course_id = c.id
		WHERE c.is_published = 1
		ORDER BY c.id, s.sort_order, p.sort_order`)
	if err != nil {
		return err
	}

	type pageRow struct {
		pageID, sectionID, courseID             int64
		courseSlug, sectSlug, pageSlug          string
		courseTitle, sectTitle, pageTitle        string
		content                                string
	}
	var pages []pageRow
	for rows.Next() {
		var pr pageRow
		if err := rows.Scan(&pr.pageID, &pr.sectionID, &pr.courseID,
			&pr.courseSlug, &pr.sectSlug, &pr.pageSlug,
			&pr.courseTitle, &pr.sectTitle, &pr.pageTitle, &pr.content); err != nil {
			rows.Close()
			return err
		}
		pages = append(pages, pr)
	}
	rows.Close()

	log.Info().Int("pages", len(pages)).Msg("semantic: embedding pages")

	// Process in batches of 64
	batchSize := 64
	h.index.Clear()
	embedded := 0

	for i := 0; i < len(pages); i += batchSize {
		end := i + batchSize
		if end > len(pages) {
			end = len(pages)
		}
		batch := pages[i:end]

		// Build embedding inputs: course > section > title + snippet
		texts := make([]string, len(batch))
		snippets := make([]string, len(batch))
		for j, p := range batch {
			content, _ := store.DecompressContent(p.content)
			plain := stripHTML(content)
			snippet := truncate(plain, 300)
			snippets[j] = snippet

			// Embedding input: hierarchical context + content
			input := p.courseTitle + " > " + p.sectTitle + " > " + p.pageTitle + "\n" + truncate(plain, 500)
			texts[j] = input
		}

		vecs, err := h.client.EmbedBatch(texts)
		if err != nil {
			log.Error().Err(err).Int("batch", i/batchSize).Msg("semantic: batch embed failed, skipping")
			continue
		}

		for j, p := range batch {
			if j >= len(vecs) {
				break
			}
			vec := vecs[j]
			snippet := snippets[j]

			h.index.Add(p.pageID, p.sectionID, p.courseID,
				p.courseSlug, p.sectSlug, p.pageSlug,
				p.courseTitle, p.sectTitle, p.pageTitle, snippet,
				vec)

			// Persist to DB
			blob := embeddings.EncodeVec(vec)
			sqlDB.ExecContext(ctx, `
				INSERT INTO page_embeddings (page_id, embedding, embedding_model, snippet, embedded_at)
				VALUES (?, ?, ?, ?, datetime('now'))
				ON CONFLICT(page_id) DO UPDATE SET
					embedding=excluded.embedding, embedding_model=excluded.embedding_model,
					snippet=excluded.snippet, embedded_at=excluded.embedded_at`,
				p.pageID, blob, h.client.Model(), snippet)
			embedded++
		}

		if (i/batchSize)%10 == 0 {
			log.Info().Int("embedded", embedded).Int("total", len(pages)).Msg("semantic: progress")
		}
	}

	log.Info().Int("embedded", embedded).Msg("semantic: reindex complete")
	return nil
}

// LoadIndex loads previously stored embeddings from DB into the in-memory index.
func (h *SemanticSearchHandler) LoadIndex(ctx context.Context) error {
	sqlDB := h.store.(*store.SQLiteStore).DB()

	rows, err := sqlDB.QueryContext(ctx, `
		SELECT pe.page_id, p.section_id, c.id, c.slug, s.slug, p.slug,
		       c.title, s.title, p.title, pe.snippet, pe.embedding
		FROM page_embeddings pe
		JOIN pages p ON pe.page_id = p.id
		JOIN sections s ON p.section_id = s.id
		JOIN courses c ON s.course_id = c.id
		WHERE c.is_published = 1`)
	if err != nil {
		return err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var pageID, sectionID, courseID int64
		var courseSlug, sectSlug, pageSlug string
		var courseTitle, sectTitle, pageTitle, snippet string
		var blob []byte

		if err := rows.Scan(&pageID, &sectionID, &courseID,
			&courseSlug, &sectSlug, &pageSlug,
			&courseTitle, &sectTitle, &pageTitle, &snippet, &blob); err != nil {
			return err
		}

		vec := embeddings.DecodeVec(blob)
		if len(vec) == 0 {
			continue
		}

		h.index.Add(pageID, sectionID, courseID,
			courseSlug, sectSlug, pageSlug,
			courseTitle, sectTitle, pageTitle, snippet,
			vec)
		count++
	}

	log.Info().Int("loaded", count).Msg("semantic: loaded embeddings from DB")
	return nil
}
