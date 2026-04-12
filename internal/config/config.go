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
	AdminEmail    string
	AdminPassword string
	AdminName     string
}

func Load() (*Config, error) {
	c := &Config{
		Port:          envInt("LEARN_PORT", 8080),
		DatabasePath:  envStr("LEARN_DB_PATH", "learn.db"),
		JWTSecret:     envStr("LEARN_JWT_SECRET", ""),
		FrontendDist:  envStr("LEARN_FRONTEND_DIST", "frontend/dist"),
		DrawDataDir:   envStr("LEARN_DRAW_DATA_DIR", "data/draw-data"),
		AdminEmail:    envStr("LEARN_ADMIN_EMAIL", "anshuman@biswas.me"),
		AdminPassword: envStr("LEARN_ADMIN_PASSWORD", ""),
		AdminName:     envStr("LEARN_ADMIN_NAME", "anshuman"),
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
