package models

import "time"

// UserRole represents the global role of a user.
type UserRole string

const (
	RoleAdmin     UserRole = "admin"
	RoleEditor    UserRole = "editor"
	RoleCommenter UserRole = "commenter"
	RoleViewer    UserRole = "viewer"
)

// Level returns a numeric level for role comparison. Higher = more access.
func (r UserRole) Level() int {
	switch r {
	case RoleAdmin:
		return 4
	case RoleEditor:
		return 3
	case RoleCommenter:
		return 2
	case RoleViewer:
		return 1
	default:
		return 0
	}
}

type User struct {
	ID           int64    `json:"id"`
	Email        string   `json:"email"`
	PasswordHash string   `json:"-"`
	DisplayName  string   `json:"display_name"`
	Role         UserRole `json:"role"`
	CreatedAt    string   `json:"created_at"`
	UpdatedAt    string   `json:"updated_at"`
	AccessTags   []Tag    `json:"access_tags,omitempty"`
}

type Course struct {
	ID            int64  `json:"id"`
	Title         string `json:"title"`
	Slug          string `json:"slug"`
	Description   string `json:"description"`
	CoverImageURL string `json:"cover_image_url,omitempty"`
	IsProtected   bool   `json:"is_protected"`
	IsPublished   bool   `json:"is_published"`
	CreatedBy     int64  `json:"created_by"`
	SortOrder     int    `json:"sort_order"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`

	// Joined fields
	AuthorName   string    `json:"author_name,omitempty"`
	SectionCount int       `json:"section_count"`
	PageCount    int       `json:"page_count"`
	Sections     []Section `json:"sections,omitempty"`
}

type Section struct {
	ID        int64  `json:"id"`
	CourseID  int64  `json:"course_id"`
	Title     string `json:"title"`
	Slug      string `json:"slug"`
	SortOrder int    `json:"sort_order"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`

	// Joined fields
	Pages []Page `json:"pages,omitempty"`
}

type Page struct {
	ID          int64  `json:"id"`
	SectionID   int64  `json:"section_id"`
	Title       string `json:"title"`
	Slug        string `json:"slug"`
	Content     string `json:"content,omitempty"`
	ContentHTML string `json:"content_html,omitempty"`
	SortOrder   int    `json:"sort_order"`
	CreatedBy   int64  `json:"created_by"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type PageVersion struct {
	ID            int64  `json:"id"`
	PageID        int64  `json:"page_id"`
	VersionNumber int    `json:"version_number"`
	Content       string `json:"content"`
	ContentHash   string `json:"content_hash"`
	CreatedBy     int64  `json:"created_by"`
	CreatedAt     string `json:"created_at"`
}

type Comment struct {
	ID        int64  `json:"id"`
	PageID    int64  `json:"page_id"`
	UserID    int64  `json:"user_id"`
	Content   string `json:"content"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`

	// Joined
	AuthorName string `json:"author_name,omitempty"`
}

type Progress struct {
	UserID      int64     `json:"user_id"`
	PageID      int64     `json:"page_id"`
	CompletedAt time.Time `json:"completed_at"`
}

type Tag struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Slug     string `json:"slug"`
	Category string `json:"category"`
	Count    int    `json:"count,omitempty"` // number of courses with this tag
}

type CourseSummary struct {
	Course
	Tags           []Tag   `json:"tags,omitempty"`
	CompletedPages int     `json:"completed_pages"`
	TotalPages     int     `json:"total_pages"`
	ProgressPct    float64 `json:"progress_pct"`
	LastViewedAt   string  `json:"last_viewed_at,omitempty"`
}

type DashboardResponse struct {
	TotalCourses   int                        `json:"total_courses"`
	InProgress     []CourseSummary            `json:"in_progress"`
	RecentlyViewed []CourseSummary            `json:"recently_viewed"`
	Categories     map[string][]CourseSummary `json:"categories"`
}

type PaginatedCourses struct {
	Courses    []CourseSummary `json:"courses"`
	TotalCount int             `json:"total_count"`
	Page       int             `json:"page"`
	PageSize   int             `json:"page_size"`
}

type StorageStats struct {
	Courses      int    `json:"courses"`
	Sections     int    `json:"sections"`
	Pages        int    `json:"pages"`
	Tags         int    `json:"tags"`
	Users        int    `json:"users"`
	Comments     int    `json:"comments"`
	PageVersions int    `json:"page_versions"`
	Progress     int    `json:"progress_entries"`
	ContentSize  int64  `json:"content_size_bytes"`
	ContentSizeH string `json:"content_size"`
	DBSize       int64  `json:"db_size_bytes"`
	DBSizeH      string `json:"db_size"`
	ImageCount   int    `json:"image_count"`
	ImageSize    int64  `json:"image_size_bytes"`
	ImageSizeH   string `json:"image_size"`
	TotalSize    int64  `json:"total_size_bytes"`
	TotalSizeH   string `json:"total_size"`
}

type APIKey struct {
	ID        int64  `json:"id"`
	UserID    int64  `json:"user_id"`
	Name      string `json:"name"`
	KeyHash   string `json:"-"`
	KeyPrefix string `json:"key_prefix"`
	CreatedAt string `json:"created_at"`
}

// ImportManifest is the structure of manifest.json from go-educative output.
type ImportManifest struct {
	Version int                  `json:"version"`
	Course  ImportManifestCourse `json:"course"`
}

type ImportManifestCourse struct {
	Title       string                    `json:"title"`
	Slug        string                    `json:"slug"`
	Description string                    `json:"description,omitempty"`
	Chapters    []ImportManifestChapter   `json:"chapters"`
}

type ImportManifestChapter struct {
	Title   string                 `json:"title"`
	Slug    string                 `json:"slug"`
	Lessons []ImportManifestLesson `json:"lessons"`
}

type ImportManifestLesson struct {
	Title    string `json:"title"`
	Slug     string `json:"slug"`
	Filename string `json:"filename"`
}
