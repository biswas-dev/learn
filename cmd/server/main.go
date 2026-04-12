package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	godraw "github.com/anchoo2kewl/go-draw"
	godrawstore "github.com/anchoo2kewl/go-draw/store"
	gowiki "github.com/anchoo2kewl/go-wiki"
	"github.com/biswas-dev/learn/internal/api"
	"github.com/biswas-dev/learn/internal/auth"
	"github.com/biswas-dev/learn/internal/config"
	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
	"github.com/biswas-dev/learn/internal/version"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnixMs
	log.Logger = zerolog.New(os.Stderr).With().Timestamp().Logger()

	info := version.Get()
	log.Info().Str("version", info.Version).Str("commit", info.GitCommit).Msg("starting learn")

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	db, err := store.NewSQLite(cfg.DatabasePath)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to open database")
	}
	defer db.Close()

	// Seed admin user
	seedAdmin(db, cfg)

	// go-wiki
	wiki := gowiki.New(
		gowiki.WithPreviewEndpoint("/api/wiki/preview"),
		gowiki.WithDrawBasePath("/draw"),
	)

	// go-draw
	var drawHandler http.Handler
	if err := os.MkdirAll(cfg.DrawDataDir, 0755); err != nil {
		log.Warn().Err(err).Msg("failed to create draw data dir")
	}
	drawStore, err := godrawstore.NewFileStore(cfg.DrawDataDir)
	if err != nil {
		log.Warn().Err(err).Msg("failed to init go-draw store")
	} else {
		dh, err := godraw.New(godraw.WithBasePath("/draw"), godraw.WithStore(drawStore))
		if err != nil {
			log.Warn().Err(err).Msg("failed to init go-draw handler")
		} else {
			drawHandler = dh.Handler()
		}
	}

	router := api.NewRouter(db, cfg, wiki, drawHandler)
	addr := ":" + strconv.Itoa(cfg.Port)

	srv := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info().Str("addr", addr).Msg("listening")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server error")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("server shutdown error")
	}
	log.Info().Msg("stopped")
}

func seedAdmin(db store.Store, cfg *config.Config) {
	ctx := context.Background()
	existing, _ := db.GetUserByEmail(ctx, cfg.AdminEmail)
	if existing != nil {
		return
	}

	password := cfg.AdminPassword
	if password == "" {
		password = "Learn2026!"
	}
	hash, err := auth.Hash(password)
	if err != nil {
		log.Error().Err(err).Msg("failed to hash admin password")
		return
	}

	admin := &models.User{
		Email:        cfg.AdminEmail,
		PasswordHash: hash,
		DisplayName:  cfg.AdminName,
		Role:         models.RoleAdmin,
	}
	if err := db.CreateUser(ctx, admin); err != nil {
		log.Error().Err(err).Msg("failed to seed admin user")
		return
	}
	log.Info().Str("email", cfg.AdminEmail).Msg("admin user seeded")
}
