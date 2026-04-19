package store

const schema = `
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'viewer',
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    cover_image_url TEXT NOT NULL DEFAULT '',
    is_protected INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL REFERENCES users(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE(course_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_sections_course ON sections(course_id, sort_order);

CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE(section_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_pages_section ON pages(section_id, sort_order);

CREATE TABLE IF NOT EXISTS page_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE(page_id, version_number)
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_page ON comments(page_id, created_at);

CREATE TABLE IF NOT EXISTS progress (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    completed_at DATETIME NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, page_id)
);
`

// migrations contains incremental ALTER TABLE statements.
// Errors are ignored (column may already exist on existing DBs).
var migrations = []string{
	`CREATE TABLE IF NOT EXISTS api_keys (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		key_hash TEXT NOT NULL UNIQUE,
		key_prefix TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT (datetime('now'))
	)`,
	"CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)",
	"CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)",

	// Tags and course categorization
	`CREATE TABLE IF NOT EXISTS tags (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		slug TEXT NOT NULL UNIQUE,
		category TEXT NOT NULL DEFAULT 'General'
	)`,
	`CREATE TABLE IF NOT EXISTS course_tags (
		course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
		tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
		PRIMARY KEY (course_id, tag_id)
	)`,
	"CREATE INDEX IF NOT EXISTS idx_course_tags_tag ON course_tags(tag_id)",

	// Recently-viewed tracking (server-side)
	`CREATE TABLE IF NOT EXISTS course_views (
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
		viewed_at DATETIME NOT NULL DEFAULT (datetime('now')),
		PRIMARY KEY (user_id, course_id)
	)`,
	"CREATE INDEX IF NOT EXISTS idx_course_views_user ON course_views(user_id, viewed_at DESC)",

	// User tag access — grants access to protected courses with matching tags
	`CREATE TABLE IF NOT EXISTS user_tag_access (
		user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
		PRIMARY KEY (user_id, tag_id)
	)`,
	"CREATE INDEX IF NOT EXISTS idx_user_tag_access_user ON user_tag_access(user_id)",

	// FTS5 for course search
	`CREATE VIRTUAL TABLE IF NOT EXISTS courses_fts USING fts5(
		title, description, tags,
		content='', tokenize='porter unicode61'
	)`,
}
