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

	// CLI subcommands before starting server
	if len(os.Args) >= 2 {
		switch os.Args[1] {
		case "create-admin":
			if len(os.Args) < 4 {
				log.Fatal().Msg("usage: learn create-admin <email> <password> [display_name]")
			}
			cliCreateAdmin(os.Args[2], os.Args[3], argOr(os.Args, 4, "admin"))
			return
		case "reset-password":
			if len(os.Args) < 4 {
				log.Fatal().Msg("usage: learn reset-password <email> <new_password>")
			}
			cliResetPassword(os.Args[2], os.Args[3])
			return
		case "list-users":
			cliListUsers()
			return
		}
	}

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

	// Seed admin user only if no users exist at all
	seedAdminIfEmpty(db, cfg)

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

// seedAdminIfEmpty creates a default admin only if the DB has zero users.
func seedAdminIfEmpty(db store.Store, cfg *config.Config) {
	ctx := context.Background()
	users, _ := db.ListUsers(ctx)
	if len(users) > 0 {
		return
	}

	email := cfg.AdminEmail
	password := cfg.AdminPassword
	if password == "" {
		password = "Learn2026"
	}
	hash, err := auth.Hash(password)
	if err != nil {
		log.Error().Err(err).Msg("failed to hash admin password")
		return
	}

	admin := &models.User{
		Email:        email,
		PasswordHash: hash,
		DisplayName:  cfg.AdminName,
		Role:         models.RoleAdmin,
	}
	if err := db.CreateUser(ctx, admin); err != nil {
		log.Error().Err(err).Msg("failed to seed admin user")
		return
	}
	log.Info().Str("email", email).Msg("admin user seeded (first run)")
}

func openDB() store.Store {
	dbPath := os.Getenv("LEARN_DB_PATH")
	if dbPath == "" {
		dbPath = "learn.db"
	}
	db, err := store.NewSQLite(dbPath)
	if err != nil {
		log.Fatal().Err(err).Str("path", dbPath).Msg("failed to open database")
	}
	return db
}

func cliCreateAdmin(email, password, displayName string) {
	if err := auth.ValidateStrength(password); err != nil {
		log.Fatal().Err(err).Msg("password too weak")
	}
	db := openDB()
	defer db.Close()

	ctx := context.Background()
	existing, _ := db.GetUserByEmail(ctx, email)
	if existing != nil {
		log.Fatal().Str("email", email).Msg("user already exists, use reset-password instead")
	}

	hash, err := auth.Hash(password)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to hash password")
	}

	user := &models.User{
		Email:        email,
		PasswordHash: hash,
		DisplayName:  displayName,
		Role:         models.RoleAdmin,
	}
	if err := db.CreateUser(ctx, user); err != nil {
		log.Fatal().Err(err).Msg("failed to create user")
	}
	log.Info().Str("email", email).Int64("id", user.ID).Msg("admin user created")
}

func cliResetPassword(email, password string) {
	if err := auth.ValidateStrength(password); err != nil {
		log.Fatal().Err(err).Msg("password too weak")
	}
	db := openDB()
	defer db.Close()

	ctx := context.Background()
	user, err := db.GetUserByEmail(ctx, email)
	if err != nil || user == nil {
		log.Fatal().Str("email", email).Msg("user not found")
	}

	hash, err := auth.Hash(password)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to hash password")
	}

	user.PasswordHash = hash
	if err := db.UpdateUser(ctx, user); err != nil {
		log.Fatal().Err(err).Msg("failed to update password")
	}
	log.Info().Str("email", email).Msg("password reset")
}

func cliListUsers() {
	db := openDB()
	defer db.Close()

	users, err := db.ListUsers(context.Background())
	if err != nil {
		log.Fatal().Err(err).Msg("failed to list users")
	}
	for _, u := range users {
		log.Info().Int64("id", u.ID).Str("email", u.Email).Str("role", string(u.Role)).Str("name", u.DisplayName).Msg("user")
	}
	if len(users) == 0 {
		log.Warn().Msg("no users found, run: learn create-admin <email> <password>")
	}
}

func argOr(args []string, idx int, fallback string) string {
	if idx < len(args) {
		return args[idx]
	}
	return fallback
}
