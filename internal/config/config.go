package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port          int
	DatabasePath  string
	JWTSecret     string
	FrontendDist  string
	DrawDataDir   string
	ImagesDir     string
	AdminEmail    string
	AdminPassword string
	AdminName     string

	// S3 storage (Backblaze B2) — when set, images are stored in S3 instead of local disk
	S3Endpoint string
	S3KeyID    string
	S3AppKey   string
	S3Bucket   string

	// Ollama for semantic search embeddings
	OllamaURL      string
	EmbeddingModel string
}

// UseS3 returns true if S3 storage is configured.
func (c *Config) UseS3() bool {
	return c.S3Bucket != "" && c.S3KeyID != "" && c.S3AppKey != ""
}

func Load() (*Config, error) {
	c := &Config{
		Port:          envInt("LEARN_PORT", 8080),
		DatabasePath:  envStr("LEARN_DB_PATH", "learn.db"),
		JWTSecret:     envStr("LEARN_JWT_SECRET", ""),
		FrontendDist:  envStr("LEARN_FRONTEND_DIST", "frontend/dist"),
		DrawDataDir:   envStr("LEARN_DRAW_DATA_DIR", "data/draw-data"),
		ImagesDir:     envStr("LEARN_IMAGES_DIR", "data/images"),
		AdminEmail:    envStr("LEARN_ADMIN_EMAIL", "anshuman@biswas.me"),
		AdminPassword: envStr("LEARN_ADMIN_PASSWORD", ""),
		AdminName:     envStr("LEARN_ADMIN_NAME", "anshuman"),
		S3Endpoint:    envStr("LEARN_S3_ENDPOINT", ""),
		S3KeyID:       envStr("LEARN_S3_KEY_ID", ""),
		S3AppKey:      envStr("LEARN_S3_APP_KEY", ""),
		S3Bucket:      envStr("LEARN_S3_BUCKET", ""),
		OllamaURL:      envStr("OLLAMA_URL", ""),
		EmbeddingModel: envStr("EMBEDDING_MODEL", "all-minilm:l6-v2"),
	}

	if c.JWTSecret == "" {
		return nil, fmt.Errorf("LEARN_JWT_SECRET is required")
	}

	return c, nil
}

func envStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
