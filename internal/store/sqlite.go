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

func (s *SQLiteStore) ListCourses(ctx context.Context, includeUnpublished, includeProtected bool) ([]models.Course, error) {
	query := `SELECT c.id, c.title, c.slug, c.description, c.cover_image_url, c.is_protected, c.is_published, c.created_by, c.sort_order, c.created_at, c.updated_at, COALESCE(u.display_name, ''),
		 (SELECT COUNT(*) FROM sections s WHERE s.course_id = c.id),
		 (SELECT COUNT(*) FROM pages p JOIN sections s ON p.section_id = s.id WHERE s.course_id = c.id)
		 FROM courses c LEFT JOIN users u ON c.created_by = u.id WHERE 1=1`
	if !includeUnpublished {
		query += ` AND c.is_published = 1`
	}
	if !includeProtected {
		query += ` AND c.is_protected = 0`
	}
	query += ` ORDER BY c.sort_order, c.created_at DESC`

	rows, err := s.db.QueryContext(ctx, query)
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
		p.SectionID, p.Title, p.Slug, p.Content, p.SortOrder, p.CreatedBy)
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
		`UPDATE pages SET content=?, updated_at=datetime('now') WHERE id=?`, content, id)
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
		v.PageID, v.VersionNumber, v.Content, v.ContentHash, v.CreatedBy)
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
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO api_keys (user_id, name, key_hash, key_prefix) VALUES (?, ?, ?, ?)`,
		k.UserID, k.Name, k.KeyHash, k.KeyPrefix)
	if err != nil {
		return err
	}
	k.ID, _ = res.LastInsertId()
	return nil
}

func (s *SQLiteStore) GetUserByAPIKeyHash(ctx context.Context, keyHash string) (*models.User, error) {
	return s.scanUser(s.db.QueryRowContext(ctx,
		`SELECT u.id, u.email, u.password_hash, u.display_name, u.role, u.created_at, u.updated_at
		 FROM users u JOIN api_keys k ON u.id = k.user_id WHERE k.key_hash = ?`, keyHash))
}

func (s *SQLiteStore) ListAPIKeys(ctx context.Context, userID int64) ([]models.APIKey, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, user_id, name, key_prefix, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var keys []models.APIKey
	for rows.Next() {
		k := models.APIKey{}
		if err := rows.Scan(&k.ID, &k.UserID, &k.Name, &k.KeyPrefix, &k.CreatedAt); err != nil {
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

// contentHash returns a SHA-256 hash of the content for version deduplication.
func contentHash(content string) string {
	h := sha256.Sum256([]byte(content))
	return fmt.Sprintf("%x", h[:8])
}
