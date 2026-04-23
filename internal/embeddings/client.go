package embeddings

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client talks to Ollama's embedding API.
// All methods are nil-safe — a nil *Client returns nil/zero values.
type Client struct {
	baseURL string
	model   string
	http    *http.Client
}

// NewClient returns a ready client, or nil if baseURL is empty.
func NewClient(baseURL, model string) *Client {
	if baseURL == "" {
		return nil
	}
	if model == "" {
		model = "all-minilm:l6-v2"
	}
	return &Client{
		baseURL: baseURL,
		model:   model,
		http:    &http.Client{Timeout: 30 * time.Second},
	}
}

// Dims returns the embedding dimension for the configured model.
func (c *Client) Dims() int {
	if c == nil {
		return 0
	}
	return 384 // all-minilm:l6-v2
}

// Model returns the model name.
func (c *Client) Model() string {
	if c == nil {
		return ""
	}
	return c.model
}

// Embed returns a single embedding vector for the given text.
func (c *Client) Embed(text string) ([]float32, error) {
	if c == nil {
		return nil, nil
	}
	vecs, err := c.EmbedBatch([]string{text})
	if err != nil {
		return nil, err
	}
	if len(vecs) == 0 {
		return nil, fmt.Errorf("empty embedding response")
	}
	return vecs[0], nil
}

// EmbedBatch returns embeddings for multiple texts in one call.
func (c *Client) EmbedBatch(texts []string) ([][]float32, error) {
	if c == nil || len(texts) == 0 {
		return nil, nil
	}

	body, _ := json.Marshal(map[string]any{
		"model": c.model,
		"input": texts,
	})

	resp, err := c.http.Post(c.baseURL+"/api/embed", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("ollama embed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ollama embed %d: %s", resp.StatusCode, string(b))
	}

	var result struct {
		Embeddings [][]float32 `json:"embeddings"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode embeddings: %w", err)
	}
	return result.Embeddings, nil
}

// Healthy returns true if Ollama is reachable and has the model loaded.
func (c *Client) Healthy() bool {
	if c == nil {
		return false
	}
	resp, err := c.http.Get(c.baseURL + "/api/tags")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}
