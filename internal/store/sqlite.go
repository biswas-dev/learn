package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"fmt"

	"github.com/biswas-dev/learn/internal/models"
	_ "modernc.org/sqlite"
)

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLite(path string) (*SQLiteStore, error) {
	dsn := fmt.Sprintf("file:%s?_journal_mode=WAL&_busy_timeout=5000&_foreign_keys=ON", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("run schema: %w", err)
	}

	for _, m := range migrations {
		db.Exec(m)
	}

	return &SQLiteStore{db: db}, nil
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

// DB returns the underlying *sql.DB for migration scripts.
func (s *SQLiteStore) DB() *sql.DB {
	return s.db
}

// --- Users ---

func (s *SQLiteStore) CreateUser(ctx context.Context, u *models.User) error {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?)`,
		u.Email, u.PasswordHash, u.DisplayName, u.Role)
	if err != nil {
		return err
	}
	u.ID, _ = res.LastInsertId()
	return nil
}

func (s *SQLiteStore) GetUserByID(ctx context.Context, id int64) (*models.User, error) {
	return s.scanUser(s.db.QueryRowContext(ctx,
		`SELECT id, email, password_hash, display_name, role, created_at, updated_at FROM users WHERE id = ?`, id))
}

func (s *SQLiteStore) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	return s.scanUser(s.db.QueryRowContext(ctx,
		`SELECT id, email, password_hash, display_name, role, created_at, updated_at FROM users WHERE email = ?`, email))
}

func (s *SQLiteStore) UpdateUser(ctx context.Context, u *models.User) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET email=?, password_hash=?, display_name=?, updated_at=datetime('now') WHERE id=?`,
		u.Email, u.PasswordHash, u.DisplayName, u.ID)
	return err
}

func (s *SQLiteStore) ListUsers(ctx context.Context) ([]models.User, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, email, password_hash, display_name, role, created_at, updated_at FROM users ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var users []models.User
	for rows.Next() {
		u := models.User{}
		if err := rows.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.DisplayName, &u.Role, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		u.PasswordHash = ""
		users = append(users, u)
	}
	return users, nil
}

func (s *SQLiteStore) UpdateUserRole(ctx context.Context, id int64, role models.UserRole) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET role=?, updated_at=datetime('now') WHERE id=?`, role, id)
	return err
}

func (s *SQLiteStore) GetUserAccessTags(ctx context.Context, userID int64) ([]models.Tag, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT t.id, t.name, t.slug, t.category FROM user_tag_access uta
		 JOIN tags t ON uta.tag_id = t.id WHERE uta.user_id = ? ORDER BY t.name`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tags []models.Tag
	for rows.Next() {
		t := models.Tag{}
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.Category); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	return tags, nil
}

func (s *SQLiteStore) GrantTagAccess(ctx context.Context, userID, tagID int64) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT OR IGNORE INTO user_tag_access (user_id, tag_id) VALUES (?, ?)`, userID, tagID)
	return err
}

func (s *SQLiteStore) RevokeTagAccess(ctx context.Context, userID, tagID int64) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM user_tag_access WHERE user_id = ? AND tag_id = ?`, userID, tagID)
	return err
}

func (s *SQLiteStore) SetUserTagAccess(ctx context.Context, userID int64, tagIDs []int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	tx.ExecContext(ctx, `DELETE FROM user_tag_access WHERE user_id = ?`, userID)
	for _, tagID := range tagIDs {
		tx.ExecContext(ctx, `INSERT INTO user_tag_access (user_id, tag_id) VALUES (?, ?)`, userID, tagID)
	}
	return tx.Commit()
}

func (s *SQLiteStore) scanUser(row *sql.Row) (*models.User, error) {
	u := &models.User{}
	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.DisplayName, &u.Role, &u.CreatedAt, &u.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return u, err
}

// --- Courses ---

func (s *SQLiteStore) CreateCourse(ctx context.Context, c *models.Course) error {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO courses (title, slug, description, cover_image_url, is_protected, is_published, created_by, sort_order)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		c.Title, c.Slug, c.Description, c.CoverImageURL, c.IsProtected, c.IsPublished, c.CreatedBy, c.SortOrder)
	if err != nil {
		return err
	}
	c.ID, _ = res.LastInsertId()
	return nil
}

func (s *SQLiteStore) GetCourseByID(ctx context.Context, id int64) (*models.Course, error) {
	return s.scanCourse(s.db.QueryRowContext(ctx,
		`SELECT c.id, c.title, c.slug, c.description, c.cover_image_url, c.is_protected, c.is_published, c.created_by, c.sort_order, c.created_at, c.updated_at, COALESCE(u.display_name, '')
		 FROM courses c LEFT JOIN users u ON c.created_by = u.id WHERE c.id = ?`, id))
}

func (s *SQLiteStore) GetCourseBySlug(ctx context.Context, slug string) (*models.Course, error) {
	return s.scanCourse(s.db.QueryRowContext(ctx,
		`SELECT c.id, c.title, c.slug, c.description, c.cover_image_url, c.is_protected, c.is_published, c.created_by, c.sort_order, c.created_at, c.updated_at, COALESCE(u.display_name, '')
		 FROM courses c LEFT JOIN users u ON c.created_by = u.id WHERE c.slug = ?`, slug))
}

func (s *SQLiteStore) UpdateCourse(ctx context.Context, c *models.Course) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE courses SET title=?, slug=?, description=?, cover_image_url=?, is_protected=?, sort_order=?, updated_at=datetime('now') WHERE id=?`,
		c.Title, c.Slug, c.Description, c.CoverImageURL, c.IsProtected, c.SortOrder, c.ID)
	return err
}

func (s *SQLiteStore) DeleteCourse(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM courses WHERE id=?`, id)
	return err
}

func (s *SQLiteStore) ListCourses(ctx context.Context, includeUnpublished bool, userID int64, isAdmin bool) ([]models.Course, error) {
	query := `SELECT c.id, c.title, c.slug, c.description, c.cover_image_url, c.is_protected, c.is_published, c.created_by, c.sort_order, c.created_at, c.updated_at, COALESCE(u.display_name, ''),
		 (SELECT COUNT(*) FROM sections s WHERE s.course_id = c.id),
		 (SELECT COUNT(*) FROM pages p JOIN sections s ON p.section_id = s.id WHERE s.course_id = c.id)
		 FROM courses c LEFT JOIN users u ON c.created_by = u.id WHERE 1=1`
	var args []any
	if !includeUnpublished {
		query += ` AND c.is_published = 1`
	}
	if !isAdmin {
		// Protected courses only visible if user has matching tag access
		if userID > 0 {
			query += ` AND (c.is_protected = 0 OR EXISTS (
				SELECT 1 FROM course_tags ct JOIN user_tag_access uta ON uta.tag_id = ct.tag_id
				WHERE ct.course_id = c.id AND uta.user_id = ?))`
			args = append(args, userID)
		} else {
			query += ` AND c.is_protected = 0`
		}
	}
	query += ` ORDER BY c.sort_order, c.created_at DESC`

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var courses []models.Course
	for rows.Next() {
		c := models.Course{}
		if err := rows.Scan(&c.ID, &c.Title, &c.Slug, &c.Description, &c.CoverImageURL, &c.IsProtected, &c.IsPublished, &c.CreatedBy, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt, &c.AuthorName, &c.SectionCount, &c.PageCount); err != nil {
			return nil, err
		}
		courses = append(courses, c)
	}
	return courses, nil
}

func (s *SQLiteStore) SetCoursePublished(ctx context.Context, id int64, published bool) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE courses SET is_published=?, updated_at=datetime('now') WHERE id=?`, published, id)
	return err
}

func (s *SQLiteStore) scanCourse(row *sql.Row) (*models.Course, error) {
	c := &models.Course{}
	err := row.Scan(&c.ID, &c.Title, &c.Slug, &c.Description, &c.CoverImageURL, &c.IsProtected, &c.IsPublished, &c.CreatedBy, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt, &c.AuthorName)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return c, err
}

// --- Sections ---

func (s *SQLiteStore) CreateSection(ctx context.Context, sec *models.Section) error {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO sections (course_id, title, slug, sort_order) VALUES (?, ?, ?, ?)`,
		sec.CourseID, sec.Title, sec.Slug, sec.SortOrder)
	if err != nil {
		return err
	}
	sec.ID, _ = res.LastInsertId()
	return nil
}

func (s *SQLiteStore) GetSectionByID(ctx context.Context, id int64) (*models.Section, error) {
	sec := &models.Section{}
	err := s.db.QueryRowContext(ctx,
		`SELECT id, course_id, title, slug, sort_order, created_at, updated_at FROM sections WHERE id = ?`, id).
		Scan(&sec.ID, &sec.CourseID, &sec.Title, &sec.Slug, &sec.SortOrder, &sec.CreatedAt, &sec.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return sec, err
}

func (s *SQLiteStore) UpdateSection(ctx context.Context, sec *models.Section) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE sections SET title=?, slug=?, sort_order=?, updated_at=datetime('now') WHERE id=?`,
		sec.Title, sec.Slug, sec.SortOrder, sec.ID)
	return err
}

func (s *SQLiteStore) DeleteSection(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sections WHERE id=?`, id)
	return err
}

func (s *SQLiteStore) ListSections(ctx context.Context, courseID int64) ([]models.Section, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, course_id, title, slug, sort_order, created_at, updated_at FROM sections WHERE course_id = ? ORDER BY sort_order`, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var sections []models.Section
	for rows.Next() {
		sec := models.Section{}
		if err := rows.Scan(&sec.ID, &sec.CourseID, &sec.Title, &sec.Slug, &sec.SortOrder, &sec.CreatedAt, &sec.UpdatedAt); err != nil {
			return nil, err
		}
		sections = append(sections, sec)
	}
	return sections, nil
}

// --- Pages ---

func (s *SQLiteStore) CreatePage(ctx context.Context, p *models.Page) error {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO pages (section_id, title, slug, content, sort_order, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
		p.SectionID, p.Title, p.Slug, CompressContent(p.Content), p.SortOrder, p.CreatedBy)
	if err != nil {
		return err
	}
	p.ID, _ = res.LastInsertId()
	return nil
}

func (s *SQLiteStore) GetPageByID(ctx context.Context, id int64) (*models.Page, error) {
	p := &models.Page{}
	err := s.db.QueryRowContext(ctx,
		`SELECT id, section_id, title, slug, content, sort_order, created_by, created_at, updated_at FROM pages WHERE id = ?`, id).
		Scan(&p.ID, &p.SectionID, &p.Title, &p.Slug, &p.Content, &p.SortOrder, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err == nil {
		p.Content, err = DecompressContent(p.Content)
	}
	return p, err
}

func (s *SQLiteStore) GetPageBySlug(ctx context.Context, sectionID int64, slug string) (*models.Page, error) {
	p := &models.Page{}
	err := s.db.QueryRowContext(ctx,
		`SELECT id, section_id, title, slug, content, sort_order, created_by, created_at, updated_at FROM pages WHERE section_id = ? AND slug = ?`, sectionID, slug).
		Scan(&p.ID, &p.SectionID, &p.Title, &p.Slug, &p.Content, &p.SortOrder, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err == nil {
		p.Content, err = DecompressContent(p.Content)
	}
	return p, err
}

func (s *SQLiteStore) UpdatePage(ctx context.Context, p *models.Page) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE pages SET title=?, slug=?, sort_order=?, updated_at=datetime('now') WHERE id=?`,
		p.Title, p.Slug, p.SortOrder, p.ID)
	return err
}

func (s *SQLiteStore) UpdatePageContent(ctx context.Context, id int64, content string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE pages SET content=?, updated_at=datetime('now') WHERE id=?`, CompressContent(content), id)
	return err
}

func (s *SQLiteStore) DeletePage(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM pages WHERE id=?`, id)
	return err
}

func (s *SQLiteStore) ListPages(ctx context.Context, sectionID int64) ([]models.Page, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, section_id, title, slug, '', sort_order, created_by, created_at, updated_at FROM pages WHERE section_id = ? ORDER BY sort_order`, sectionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var pages []models.Page
	for rows.Next() {
		p := models.Page{}
		if err := rows.Scan(&p.ID, &p.SectionID, &p.Title, &p.Slug, &p.Content, &p.SortOrder, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		pages = append(pages, p)
	}
	return pages, nil
}

// --- Page Versions ---

func (s *SQLiteStore) CreatePageVersion(ctx context.Context, v *models.PageVersion) error {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO page_versions (page_id, version_number, content, content_hash, created_by) VALUES (?, ?, ?, ?, ?)`,
		v.PageID, v.VersionNumber, CompressContent(v.Content), v.ContentHash, v.CreatedBy)
	if err != nil {
		return err
	}
	v.ID, _ = res.LastInsertId()
	return nil
}

func (s *SQLiteStore) ListPageVersions(ctx context.Context, pageID int64) ([]models.PageVersion, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, page_id, version_number, '', content_hash, created_by, created_at FROM page_versions WHERE page_id = ? ORDER BY version_number DESC`, pageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var versions []models.PageVersion
	for rows.Next() {
		v := models.PageVersion{}
		if err := rows.Scan(&v.ID, &v.PageID, &v.VersionNumber, &v.Content, &v.ContentHash, &v.CreatedBy, &v.CreatedAt); err != nil {
			return nil, err
		}
		versions = append(versions, v)
	}
	return versions, nil
}

func (s *SQLiteStore) GetPageVersion(ctx context.Context, pageID int64, versionNumber int) (*models.PageVersion, error) {
	v := &models.PageVersion{}
	err := s.db.QueryRowContext(ctx,
		`SELECT id, page_id, version_number, content, content_hash, created_by, created_at FROM page_versions WHERE page_id = ? AND version_number = ?`, pageID, versionNumber).
		Scan(&v.ID, &v.PageID, &v.VersionNumber, &v.Content, &v.ContentHash, &v.CreatedBy, &v.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err == nil {
		v.Content, err = DecompressContent(v.Content)
	}
	return v, err
}

func (s *SQLiteStore) GetLatestVersionNumber(ctx context.Context, pageID int64) (int, error) {
	var num int
	err := s.db.QueryRowContext(ctx,
		`SELECT COALESCE(MAX(version_number), 0) FROM page_versions WHERE page_id = ?`, pageID).Scan(&num)
	return num, err
}

// --- Comments ---

func (s *SQLiteStore) CreateComment(ctx context.Context, c *models.Comment) error {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO comments (page_id, user_id, content) VALUES (?, ?, ?)`,
		c.PageID, c.UserID, c.Content)
	if err != nil {
		return err
	}
	c.ID, _ = res.LastInsertId()
	return nil
}

func (s *SQLiteStore) GetCommentByID(ctx context.Context, id int64) (*models.Comment, error) {
	c := &models.Comment{}
	err := s.db.QueryRowContext(ctx,
		`SELECT c.id, c.page_id, c.user_id, c.content, c.created_at, c.updated_at, COALESCE(u.display_name, '')
		 FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?`, id).
		Scan(&c.ID, &c.PageID, &c.UserID, &c.Content, &c.CreatedAt, &c.UpdatedAt, &c.AuthorName)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return c, err
}

func (s *SQLiteStore) DeleteComment(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM comments WHERE id=?`, id)
	return err
}

func (s *SQLiteStore) ListComments(ctx context.Context, pageID int64) ([]models.Comment, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT c.id, c.page_id, c.user_id, c.content, c.created_at, c.updated_at, COALESCE(u.display_name, '')
		 FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.page_id = ? ORDER BY c.created_at`, pageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var comments []models.Comment
	for rows.Next() {
		c := models.Comment{}
		if err := rows.Scan(&c.ID, &c.PageID, &c.UserID, &c.Content, &c.CreatedAt, &c.UpdatedAt, &c.AuthorName); err != nil {
			return nil, err
		}
		comments = append(comments, c)
	}
	return comments, nil
}

// --- Progress ---

func (s *SQLiteStore) MarkPageComplete(ctx context.Context, userID, pageID int64) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT OR IGNORE INTO progress (user_id, page_id) VALUES (?, ?)`, userID, pageID)
	return err
}

func (s *SQLiteStore) GetCourseProgress(ctx context.Context, userID, courseID int64) ([]models.Progress, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT pr.user_id, pr.page_id, pr.completed_at
		 FROM progress pr
		 JOIN pages p ON pr.page_id = p.id
		 JOIN sections sec ON p.section_id = sec.id
		 WHERE pr.user_id = ? AND sec.course_id = ?`, userID, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var progress []models.Progress
	for rows.Next() {
		p := models.Progress{}
		if err := rows.Scan(&p.UserID, &p.PageID, &p.CompletedAt); err != nil {
			return nil, err
		}
		progress = append(progress, p)
	}
	return progress, nil
}

// --- API Keys ---

func (s *SQLiteStore) CreateAPIKey(ctx context.Context, k *models.APIKey) error {
	var expiresAt any
	if k.ExpiresAt != "" {
		expiresAt = k.ExpiresAt
	}
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO api_keys (user_id, name, key_hash, key_prefix, expires_at) VALUES (?, ?, ?, ?, ?)`,
		k.UserID, k.Name, k.KeyHash, k.KeyPrefix, expiresAt)
	if err != nil {
		return err
	}
	k.ID, _ = res.LastInsertId()
	return nil
}

func (s *SQLiteStore) GetUserByAPIKeyHash(ctx context.Context, keyHash string) (*models.User, error) {
	// Check expiration: only match non-expired keys
	return s.scanUser(s.db.QueryRowContext(ctx,
		`SELECT u.id, u.email, u.password_hash, u.display_name, u.role, u.created_at, u.updated_at
		 FROM users u JOIN api_keys k ON u.id = k.user_id
		 WHERE k.key_hash = ? AND (k.expires_at IS NULL OR k.expires_at > datetime('now'))`, keyHash))
}

func (s *SQLiteStore) ListAPIKeys(ctx context.Context, userID int64) ([]models.APIKey, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, user_id, name, key_prefix, COALESCE(expires_at, ''), created_at
		 FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var keys []models.APIKey
	for rows.Next() {
		k := models.APIKey{}
		if err := rows.Scan(&k.ID, &k.UserID, &k.Name, &k.KeyPrefix, &k.ExpiresAt, &k.CreatedAt); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, nil
}

func (s *SQLiteStore) DeleteAPIKey(ctx context.Context, id, userID int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM api_keys WHERE id=? AND user_id=?`, id, userID)
	return err
}

// --- Stats ---

func (s *SQLiteStore) GetStorageStats(ctx context.Context) (*models.StorageStats, error) {
	st := &models.StorageStats{}

	s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM courses WHERE is_published = 1`).Scan(&st.Courses)
	s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM sections`).Scan(&st.Sections)
	s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM pages`).Scan(&st.Pages)
	s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM tags`).Scan(&st.Tags)
	s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&st.Users)
	s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM comments`).Scan(&st.Comments)
	s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM page_versions`).Scan(&st.PageVersions)
	s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM progress`).Scan(&st.Progress)
	s.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(LENGTH(content)), 0) FROM pages`).Scan(&st.ContentSize)
	st.ContentSizeH = humanSize(st.ContentSize)

	// DB file size via page_count * page_size
	var pageCount, pageSize int64
	s.db.QueryRowContext(ctx, `PRAGMA page_count`).Scan(&pageCount)
	s.db.QueryRowContext(ctx, `PRAGMA page_size`).Scan(&pageSize)
	st.DBSize = pageCount * pageSize
	st.DBSizeH = humanSize(st.DBSize)

	return st, nil
}

func humanSize(b int64) string {
	const (
		kb = 1024
		mb = kb * 1024
		gb = mb * 1024
	)
	switch {
	case b >= gb:
		return fmt.Sprintf("%.1f GB", float64(b)/float64(gb))
	case b >= mb:
		return fmt.Sprintf("%.1f MB", float64(b)/float64(mb))
	case b >= kb:
		return fmt.Sprintf("%.1f KB", float64(b)/float64(kb))
	default:
		return fmt.Sprintf("%d B", b)
	}
}

// contentHash returns a SHA-256 hash of the content for version deduplication.
func contentHash(content string) string {
	h := sha256.Sum256([]byte(content))
	return fmt.Sprintf("%x", h[:8])
}

// --- Tags ---

func (s *SQLiteStore) GetOrCreateTag(ctx context.Context, name, slug, category string) (*models.Tag, error) {
	tag := &models.Tag{}
	err := s.db.QueryRowContext(ctx, `SELECT id, name, slug, category FROM tags WHERE slug = ?`, slug).
		Scan(&tag.ID, &tag.Name, &tag.Slug, &tag.Category)
	if err == sql.ErrNoRows {
		res, err := s.db.ExecContext(ctx,
			`INSERT INTO tags (name, slug, category) VALUES (?, ?, ?)`, name, slug, category)
		if err != nil {
			return nil, err
		}
		tag.ID, _ = res.LastInsertId()
		tag.Name = name
		tag.Slug = slug
		tag.Category = category
		return tag, nil
	}
	return tag, err
}

func (s *SQLiteStore) AddCourseTag(ctx context.Context, courseID, tagID int64) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT OR IGNORE INTO course_tags (course_id, tag_id) VALUES (?, ?)`, courseID, tagID)
	return err
}

func (s *SQLiteStore) ListCourseTags(ctx context.Context, courseID int64) ([]models.Tag, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT t.id, t.name, t.slug, t.category FROM tags t
		 JOIN course_tags ct ON t.id = ct.tag_id WHERE ct.course_id = ? ORDER BY t.name`, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tags []models.Tag
	for rows.Next() {
		t := models.Tag{}
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.Category); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	return tags, nil
}

func (s *SQLiteStore) ListTagsWithCounts(ctx context.Context) ([]models.Tag, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT t.id, t.name, t.slug, t.category, COUNT(ct.course_id) as cnt
		 FROM tags t JOIN course_tags ct ON t.id = ct.tag_id
		 JOIN courses c ON ct.course_id = c.id AND c.is_published = 1
		 GROUP BY t.id ORDER BY cnt DESC, t.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tags []models.Tag
	for rows.Next() {
		t := models.Tag{}
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.Category, &t.Count); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	return tags, nil
}

// --- Search ---

func (s *SQLiteStore) SearchCourses(ctx context.Context, query string, limit int, userID int64, isAdmin bool) ([]models.CourseSummary, error) {
	if limit <= 0 {
		limit = 20
	}
	protectedFilter := ` AND c.is_protected = 0`
	var args []any
	args = append(args, query)
	if isAdmin {
		protectedFilter = ""
	} else if userID > 0 {
		protectedFilter = ` AND (c.is_protected = 0 OR EXISTS (
			SELECT 1 FROM course_tags ct JOIN user_tag_access uta ON uta.tag_id = ct.tag_id
			WHERE ct.course_id = c.id AND uta.user_id = ?))`
		args = append(args, userID)
	}
	args = append(args, limit)
	rows, err := s.db.QueryContext(ctx,
		`SELECT c.id, c.title, c.slug, c.description, c.cover_image_url, c.is_protected, c.is_published,
			c.created_by, c.sort_order, c.created_at, c.updated_at, COALESCE(u.display_name, ''),
			(SELECT COUNT(*) FROM sections s WHERE s.course_id = c.id),
			(SELECT COUNT(*) FROM pages p JOIN sections s ON p.section_id = s.id WHERE s.course_id = c.id)
		 FROM courses_fts fts
		 JOIN courses c ON fts.rowid = c.id
		 LEFT JOIN users u ON c.created_by = u.id
		 WHERE courses_fts MATCH ? AND c.is_published = 1` + protectedFilter + `
		 ORDER BY rank
		 LIMIT ?`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return s.scanCourseSummaries(rows)
}

func (s *SQLiteStore) IndexCourseForSearch(ctx context.Context, courseID int64) error {
	// Delete existing entry
	s.db.ExecContext(ctx, `DELETE FROM courses_fts WHERE rowid = ?`, courseID)
	// Re-insert with tags
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO courses_fts(rowid, title, description, tags)
		 SELECT c.id, c.title, c.description,
			COALESCE((SELECT GROUP_CONCAT(t.name, ' ') FROM course_tags ct JOIN tags t ON ct.tag_id = t.id WHERE ct.course_id = c.id), '')
		 FROM courses c WHERE c.id = ? AND c.is_published = 1`, courseID)
	return err
}

// IndexAllCoursesForSearch rebuilds the entire FTS index.
func (s *SQLiteStore) IndexAllCoursesForSearch(ctx context.Context) error {
	s.db.ExecContext(ctx, `DELETE FROM courses_fts`)
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO courses_fts(rowid, title, description, tags)
		 SELECT c.id, c.title, c.description,
			COALESCE((SELECT GROUP_CONCAT(t.name, ' ') FROM course_tags ct JOIN tags t ON ct.tag_id = t.id WHERE ct.course_id = c.id), '')
		 FROM courses c WHERE c.is_published = 1`)
	return err
}

// --- Course Views ---

func (s *SQLiteStore) RecordCourseView(ctx context.Context, userID, courseID int64) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO course_views (user_id, course_id, viewed_at) VALUES (?, ?, datetime('now'))
		 ON CONFLICT(user_id, course_id) DO UPDATE SET viewed_at = datetime('now')`, userID, courseID)
	return err
}

// --- Enhanced Progress ---

func (s *SQLiteStore) GetAllCourseProgress(ctx context.Context, userID int64) (map[int64]int, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT sec.course_id, COUNT(*)
		 FROM progress pr
		 JOIN pages p ON pr.page_id = p.id
		 JOIN sections sec ON p.section_id = sec.id
		 WHERE pr.user_id = ?
		 GROUP BY sec.course_id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	m := make(map[int64]int)
	for rows.Next() {
		var courseID int64
		var count int
		if err := rows.Scan(&courseID, &count); err != nil {
			return nil, err
		}
		m[courseID] = count
	}
	return m, nil
}

func (s *SQLiteStore) GetCoursesInProgress(ctx context.Context, userID int64, limit int) ([]models.CourseSummary, error) {
	if limit <= 0 {
		limit = 6
	}
	// Use a wrapping query to filter by progress since HAVING without GROUP BY is non-standard
	rows, err := s.db.QueryContext(ctx,
		`SELECT * FROM (
			SELECT c.id, c.title, c.slug, c.description, c.cover_image_url, c.is_protected, c.is_published,
				c.created_by, c.sort_order, c.created_at, c.updated_at, COALESCE(u.display_name, ''),
				(SELECT COUNT(*) FROM sections s WHERE s.course_id = c.id) as sec_cnt,
				(SELECT COUNT(*) FROM pages p JOIN sections s ON p.section_id = s.id WHERE s.course_id = c.id) as total_pages,
				(SELECT COUNT(*) FROM progress pr JOIN pages p ON pr.page_id = p.id JOIN sections s ON p.section_id = s.id WHERE s.course_id = c.id AND pr.user_id = ?) as completed_pages,
				(SELECT MAX(pr2.completed_at) FROM progress pr2 JOIN pages p2 ON pr2.page_id = p2.id JOIN sections s2 ON p2.section_id = s2.id WHERE s2.course_id = c.id AND pr2.user_id = ?) as last_activity
			 FROM courses c
			 LEFT JOIN users u ON c.created_by = u.id
			 WHERE c.is_published = 1
			   AND c.id IN (SELECT DISTINCT sec.course_id FROM progress pr JOIN pages p ON pr.page_id = p.id JOIN sections sec ON p.section_id = sec.id WHERE pr.user_id = ?)
		 ) WHERE completed_pages > 0 AND completed_pages < total_pages
		 ORDER BY last_activity DESC
		 LIMIT ?`, userID, userID, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var courses []models.CourseSummary
	for rows.Next() {
		cs := models.CourseSummary{}
		var lastActivity sql.NullString
		if err := rows.Scan(&cs.ID, &cs.Title, &cs.Slug, &cs.Description, &cs.CoverImageURL,
			&cs.IsProtected, &cs.IsPublished, &cs.CreatedBy, &cs.SortOrder,
			&cs.CreatedAt, &cs.UpdatedAt, &cs.AuthorName,
			&cs.SectionCount, &cs.TotalPages, &cs.CompletedPages, &lastActivity); err != nil {
			return nil, err
		}
		if cs.TotalPages > 0 {
			cs.ProgressPct = float64(cs.CompletedPages) / float64(cs.TotalPages) * 100
		}
		cs.PageCount = cs.TotalPages
		courses = append(courses, cs)
	}
	return courses, nil
}

// --- Dashboard ---

func (s *SQLiteStore) GetDashboard(ctx context.Context, userID int64, isAdmin bool) (*models.DashboardResponse, error) {
	resp := &models.DashboardResponse{
		Categories: make(map[string][]models.CourseSummary),
	}

	// Build protected course filter
	protectedFilter := ` AND c.is_protected = 0`
	var protectedArgs []any
	if isAdmin {
		protectedFilter = ""
	} else if userID > 0 {
		protectedFilter = ` AND (c.is_protected = 0 OR EXISTS (
			SELECT 1 FROM course_tags ct JOIN user_tag_access uta ON uta.tag_id = ct.tag_id
			WHERE ct.course_id = c.id AND uta.user_id = ?))`
		protectedArgs = append(protectedArgs, userID)
	}

	// Total visible published courses
	countQuery := `SELECT COUNT(*) FROM courses c WHERE c.is_published = 1` + protectedFilter
	s.db.QueryRowContext(ctx, countQuery, protectedArgs...).Scan(&resp.TotalCourses)

	// Get progress map first (single query, fully consumed)
	progressMap, _ := s.GetAllCourseProgress(ctx, userID)

	// In-progress courses (fully consumed before next query)
	inProgress, err := s.GetCoursesInProgress(ctx, userID, 6)
	if err != nil {
		return nil, fmt.Errorf("in-progress: %w", err)
	}
	resp.InProgress = inProgress
	if resp.InProgress == nil {
		resp.InProgress = []models.CourseSummary{}
	}

	// Enrich in-progress with tags (sequential — safe with single conn)
	for i := range resp.InProgress {
		tags, _ := s.ListCourseTags(ctx, resp.InProgress[i].ID)
		resp.InProgress[i].Tags = tags
	}

	// Recently viewed (fully consumed into slice before next query)
	recentQuery := `SELECT c.id, c.title, c.slug, c.description, c.cover_image_url, c.is_protected, c.is_published,
			c.created_by, c.sort_order, c.created_at, c.updated_at, COALESCE(u.display_name, ''),
			(SELECT COUNT(*) FROM sections s WHERE s.course_id = c.id),
			(SELECT COUNT(*) FROM pages p JOIN sections s ON p.section_id = s.id WHERE s.course_id = c.id),
			cv.viewed_at
		 FROM course_views cv
		 JOIN courses c ON cv.course_id = c.id
		 LEFT JOIN users u ON c.created_by = u.id
		 WHERE cv.user_id = ? AND c.is_published = 1` + protectedFilter + `
		 ORDER BY cv.viewed_at DESC
		 LIMIT 6`
	recentArgs := []any{userID}
	recentArgs = append(recentArgs, protectedArgs...)
	recentRows, err := s.db.QueryContext(ctx, recentQuery, recentArgs...)
	if err != nil {
		return nil, fmt.Errorf("recently viewed: %w", err)
	}
	for recentRows.Next() {
		cs := models.CourseSummary{}
		if err := recentRows.Scan(&cs.ID, &cs.Title, &cs.Slug, &cs.Description, &cs.CoverImageURL,
			&cs.IsProtected, &cs.IsPublished, &cs.CreatedBy, &cs.SortOrder,
			&cs.CreatedAt, &cs.UpdatedAt, &cs.AuthorName,
			&cs.SectionCount, &cs.TotalPages, &cs.LastViewedAt); err != nil {
			recentRows.Close()
			return nil, err
		}
		cs.PageCount = cs.TotalPages
		if completed, ok := progressMap[cs.ID]; ok {
			cs.CompletedPages = completed
			if cs.TotalPages > 0 {
				cs.ProgressPct = float64(completed) / float64(cs.TotalPages) * 100
			}
		}
		resp.RecentlyViewed = append(resp.RecentlyViewed, cs)
	}
	recentRows.Close() // Explicitly close before next query

	if resp.RecentlyViewed == nil {
		resp.RecentlyViewed = []models.CourseSummary{}
	}

	// Enrich recently viewed with tags
	for i := range resp.RecentlyViewed {
		tags, _ := s.ListCourseTags(ctx, resp.RecentlyViewed[i].ID)
		resp.RecentlyViewed[i].Tags = tags
	}

	// Categories: get all published courses grouped by category (fully consumed into slice)
	catQuery := `SELECT t.category, c.id, c.title, c.slug, c.description, c.cover_image_url,
			c.is_protected, c.is_published, c.created_by, c.sort_order, c.created_at, c.updated_at,
			COALESCE(u.display_name, ''),
			(SELECT COUNT(*) FROM sections s WHERE s.course_id = c.id),
			(SELECT COUNT(*) FROM pages p JOIN sections s ON p.section_id = s.id WHERE s.course_id = c.id)
		 FROM course_tags ct
		 JOIN tags t ON ct.tag_id = t.id
		 JOIN courses c ON ct.course_id = c.id
		 LEFT JOIN users u ON c.created_by = u.id
		 WHERE c.is_published = 1 AND t.category != 'Source'` + protectedFilter + `
		 ORDER BY t.category, c.title`
	catRows, err := s.db.QueryContext(ctx, catQuery, protectedArgs...)
	if err != nil {
		return nil, fmt.Errorf("categories: %w", err)
	}
	seen := make(map[string]map[int64]bool) // deduplicate courses per category
	for catRows.Next() {
		var category string
		cs := models.CourseSummary{}
		if err := catRows.Scan(&category, &cs.ID, &cs.Title, &cs.Slug, &cs.Description, &cs.CoverImageURL,
			&cs.IsProtected, &cs.IsPublished, &cs.CreatedBy, &cs.SortOrder,
			&cs.CreatedAt, &cs.UpdatedAt, &cs.AuthorName,
			&cs.SectionCount, &cs.TotalPages); err != nil {
			catRows.Close()
			return nil, err
		}
		cs.PageCount = cs.TotalPages
		if completed, ok := progressMap[cs.ID]; ok {
			cs.CompletedPages = completed
			if cs.TotalPages > 0 {
				cs.ProgressPct = float64(completed) / float64(cs.TotalPages) * 100
			}
		}
		if seen[category] == nil {
			seen[category] = make(map[int64]bool)
		}
		if seen[category][cs.ID] {
			continue
		}
		seen[category][cs.ID] = true
		resp.Categories[category] = append(resp.Categories[category], cs)
	}
	catRows.Close()

	// Enrich category courses with tags
	for cat := range resp.Categories {
		for i := range resp.Categories[cat] {
			tags, _ := s.ListCourseTags(ctx, resp.Categories[cat][i].ID)
			resp.Categories[cat][i].Tags = tags
		}
	}

	return resp, nil
}

// --- Paginated Listing ---

func (s *SQLiteStore) ListCoursesPaginated(ctx context.Context, page, size int, category, tag string, userID int64, isAdmin bool) (*models.PaginatedCourses, error) {
	if page < 1 {
		page = 1
	}
	if size <= 0 || size > 100 {
		size = 24
	}
	offset := (page - 1) * size

	baseWhere := `c.is_published = 1`
	var args []any
	if !isAdmin {
		if userID > 0 {
			baseWhere += ` AND (c.is_protected = 0 OR EXISTS (
				SELECT 1 FROM course_tags ct2 JOIN user_tag_access uta ON uta.tag_id = ct2.tag_id
				WHERE ct2.course_id = c.id AND uta.user_id = ?))`
			args = append(args, userID)
		} else {
			baseWhere += ` AND c.is_protected = 0`
		}
	}

	joinClause := ""
	if category != "" {
		joinClause = ` JOIN course_tags ct ON ct.course_id = c.id JOIN tags t ON ct.tag_id = t.id`
		baseWhere += ` AND t.category = ?`
		args = append(args, category)
	} else if tag != "" {
		joinClause = ` JOIN course_tags ct ON ct.course_id = c.id JOIN tags t ON ct.tag_id = t.id`
		baseWhere += ` AND t.slug = ?`
		args = append(args, tag)
	}

	// Count total
	var totalCount int
	countQuery := `SELECT COUNT(DISTINCT c.id) FROM courses c` + joinClause + ` WHERE ` + baseWhere
	if err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&totalCount); err != nil {
		return nil, err
	}

	// Fetch page
	dataQuery := `SELECT DISTINCT c.id, c.title, c.slug, c.description, c.cover_image_url, c.is_protected, c.is_published,
		c.created_by, c.sort_order, c.created_at, c.updated_at, COALESCE(u.display_name, ''),
		(SELECT COUNT(*) FROM sections s WHERE s.course_id = c.id),
		(SELECT COUNT(*) FROM pages p JOIN sections s ON p.section_id = s.id WHERE s.course_id = c.id)
	 FROM courses c` + joinClause + ` LEFT JOIN users u ON c.created_by = u.id
	 WHERE ` + baseWhere + `
	 ORDER BY c.sort_order, c.title
	 LIMIT ? OFFSET ?`

	dataArgs := append(args, size, offset)
	rows, err := s.db.QueryContext(ctx, dataQuery, dataArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	summaries, err := s.scanCourseSummaries(rows)
	if err != nil {
		return nil, err
	}

	// Enrich with tags
	for i := range summaries {
		tags, _ := s.ListCourseTags(ctx, summaries[i].ID)
		summaries[i].Tags = tags
	}

	return &models.PaginatedCourses{
		Courses:    summaries,
		TotalCount: totalCount,
		Page:       page,
		PageSize:   size,
	}, nil
}

// scanCourseSummaries scans course rows into CourseSummary slices (no progress info).
func (s *SQLiteStore) scanCourseSummaries(rows *sql.Rows) ([]models.CourseSummary, error) {
	var courses []models.CourseSummary
	for rows.Next() {
		cs := models.CourseSummary{}
		if err := rows.Scan(&cs.ID, &cs.Title, &cs.Slug, &cs.Description, &cs.CoverImageURL,
			&cs.IsProtected, &cs.IsPublished, &cs.CreatedBy, &cs.SortOrder,
			&cs.CreatedAt, &cs.UpdatedAt, &cs.AuthorName,
			&cs.SectionCount, &cs.TotalPages); err != nil {
			return nil, err
		}
		cs.PageCount = cs.TotalPages
		courses = append(courses, cs)
	}
	if courses == nil {
		courses = []models.CourseSummary{}
	}
	return courses, nil
}
