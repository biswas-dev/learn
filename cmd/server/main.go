package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	godraw "github.com/anchoo2kewl/go-draw"
	godrawstore "github.com/anchoo2kewl/go-draw/store"
	gowiki "github.com/anchoo2kewl/go-wiki"
	"github.com/biswas-dev/learn/internal/api"
	"github.com/biswas-dev/learn/internal/images"
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

	// CLI subcommands — these only need the DB, not the full server config
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
		case "compress-content":
			cliCompressContent()
			return
		case "compress-images":
			cliCompressImages()
			return
		case "migrate-to-s3":
			cliMigrateToS3()
			return
		}
	}

	// --- Server startup below (requires full config) ---
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

	// Image store: S3 on prod, local on dev
	var imgStore images.Store
	if cfg.UseS3() {
		imgStore, err = images.NewS3Store(cfg.S3Endpoint, cfg.S3KeyID, cfg.S3AppKey, cfg.S3Bucket)
		if err != nil {
			log.Fatal().Err(err).Msg("failed to init S3 image store")
		}
		log.Info().Str("bucket", cfg.S3Bucket).Msg("using S3 image storage")
	} else {
		imgStore, err = images.NewLocalStore(cfg.ImagesDir)
		if err != nil {
			log.Fatal().Err(err).Msg("failed to init local image store")
		}
		log.Info().Str("dir", cfg.ImagesDir).Msg("using local image storage")
	}

	router := api.NewRouter(db, cfg, wiki, drawHandler, imgStore)
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

func cliCompressContent() {
	db := openDB()
	defer db.Close()
	ctx := context.Background()

	// Compress all page content that isn't already compressed
	rows, err := db.(*store.SQLiteStore).DB().QueryContext(ctx,
		`SELECT id, content FROM pages WHERE content != '' AND content NOT LIKE 'zlib:%'`)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to query pages")
	}
	var updates []struct{ id int64; compressed string }
	for rows.Next() {
		var id int64
		var content string
		if err := rows.Scan(&id, &content); err != nil {
			log.Fatal().Err(err).Msg("scan error")
		}
		compressed := store.CompressContent(content)
		if compressed != content {
			updates = append(updates, struct{ id int64; compressed string }{id, compressed})
		}
	}
	rows.Close()

	for _, u := range updates {
		if _, err := db.(*store.SQLiteStore).DB().ExecContext(ctx,
			`UPDATE pages SET content=? WHERE id=?`, u.compressed, u.id); err != nil {
			log.Error().Err(err).Int64("id", u.id).Msg("failed to compress page")
			continue
		}
	}
	log.Info().Int("pages", len(updates)).Msg("pages compressed")

	// Compress page versions
	vrows, err := db.(*store.SQLiteStore).DB().QueryContext(ctx,
		`SELECT id, content FROM page_versions WHERE content != '' AND content NOT LIKE 'zlib:%'`)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to query versions")
	}
	var vupdates []struct{ id int64; compressed string }
	for vrows.Next() {
		var id int64
		var content string
		if err := vrows.Scan(&id, &content); err != nil {
			log.Fatal().Err(err).Msg("scan error")
		}
		compressed := store.CompressContent(content)
		if compressed != content {
			vupdates = append(vupdates, struct{ id int64; compressed string }{id, compressed})
		}
	}
	vrows.Close()

	for _, u := range vupdates {
		if _, err := db.(*store.SQLiteStore).DB().ExecContext(ctx,
			`UPDATE page_versions SET content=? WHERE id=?`, u.compressed, u.id); err != nil {
			log.Error().Err(err).Int64("id", u.id).Msg("failed to compress version")
			continue
		}
	}
	log.Info().Int("versions", len(vupdates)).Msg("versions compressed")

	// VACUUM to reclaim space
	if _, err := db.(*store.SQLiteStore).DB().ExecContext(ctx, `VACUUM`); err != nil {
		log.Warn().Err(err).Msg("vacuum failed")
	}
	log.Info().Msg("done")
}

func cliMigrateToS3() {
	localDir := os.Getenv("LEARN_IMAGES_DIR")
	if localDir == "" {
		localDir = "data/images"
	}
	endpoint := os.Getenv("LEARN_S3_ENDPOINT")
	keyID := os.Getenv("LEARN_S3_KEY_ID")
	appKey := os.Getenv("LEARN_S3_APP_KEY")
	bucket := os.Getenv("LEARN_S3_BUCKET")

	if bucket == "" || keyID == "" || appKey == "" {
		log.Fatal().Msg("LEARN_S3_ENDPOINT, LEARN_S3_KEY_ID, LEARN_S3_APP_KEY, LEARN_S3_BUCKET are required")
	}

	s3Store, err := images.NewS3Store(endpoint, keyID, appKey, bucket)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to init S3 store")
	}

	entries, err := os.ReadDir(localDir)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to read local images dir")
	}

	uploaded := 0
	skipped := 0
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if s3Store.Exists(name) {
			skipped++
			continue
		}
		f, err := os.Open(filepath.Join(localDir, name))
		if err != nil {
			log.Error().Err(err).Str("file", name).Msg("failed to open")
			continue
		}
		if err := s3Store.Save(name, f); err != nil {
			f.Close()
			log.Error().Err(err).Str("file", name).Msg("failed to upload")
			continue
		}
		f.Close()
		uploaded++
		if uploaded%50 == 0 {
			log.Info().Int("uploaded", uploaded).Int("skipped", skipped).Msg("progress")
		}
	}
	log.Info().Int("uploaded", uploaded).Int("skipped", skipped).Msg("migration complete")
}

func cliCompressImages() {
	imagesDir := os.Getenv("LEARN_IMAGES_DIR")
	if imagesDir == "" {
		imagesDir = "data/images"
	}

	entries, err := os.ReadDir(imagesDir)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to read images dir")
	}

	compressed := 0
	var savedBytes int64
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".svg") {
			continue
		}
		svgPath := filepath.Join(imagesDir, e.Name())
		gzPath := svgPath + ".gz"

		// Skip if already compressed
		if _, err := os.Stat(gzPath); err == nil {
			continue
		}

		data, err := os.ReadFile(svgPath)
		if err != nil {
			continue
		}

		var buf bytes.Buffer
		gz, _ := gzip.NewWriterLevel(&buf, gzip.BestCompression)
		gz.Write(data)
		gz.Close()

		if err := os.WriteFile(gzPath, buf.Bytes(), 0644); err != nil {
			continue
		}

		savedBytes += int64(len(data)) - int64(buf.Len())
		compressed++

		// Remove the original uncompressed SVG
		os.Remove(svgPath)
	}
	log.Info().Int("files", compressed).Int64("saved_mb", savedBytes/1024/1024).Msg("SVGs compressed")
}

func argOr(args []string, idx int, fallback string) string {
	if idx < len(args) {
		return args[idx]
	}
	return fallback
}
