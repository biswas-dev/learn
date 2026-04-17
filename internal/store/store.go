package store

import (
	"context"

	"github.com/biswas-dev/learn/internal/models"
)

// Store defines all data access methods.
type Store interface {
	Close() error

	// Users
	CreateUser(ctx context.Context, user *models.User) error
	GetUserByID(ctx context.Context, id int64) (*models.User, error)
	GetUserByEmail(ctx context.Context, email string) (*models.User, error)
	UpdateUser(ctx context.Context, user *models.User) error
	ListUsers(ctx context.Context) ([]models.User, error)
	UpdateUserRole(ctx context.Context, id int64, role models.UserRole) error

	// Courses
	CreateCourse(ctx context.Context, course *models.Course) error
	GetCourseByID(ctx context.Context, id int64) (*models.Course, error)
	GetCourseBySlug(ctx context.Context, slug string) (*models.Course, error)
	UpdateCourse(ctx context.Context, course *models.Course) error
	DeleteCourse(ctx context.Context, id int64) error
	ListCourses(ctx context.Context, includeUnpublished, includeProtected bool) ([]models.Course, error)
	SetCoursePublished(ctx context.Context, id int64, published bool) error

	// Sections
	CreateSection(ctx context.Context, section *models.Section) error
	GetSectionByID(ctx context.Context, id int64) (*models.Section, error)
	UpdateSection(ctx context.Context, section *models.Section) error
	DeleteSection(ctx context.Context, id int64) error
	ListSections(ctx context.Context, courseID int64) ([]models.Section, error)

	// Pages
	CreatePage(ctx context.Context, page *models.Page) error
	GetPageByID(ctx context.Context, id int64) (*models.Page, error)
	GetPageBySlug(ctx context.Context, sectionID int64, slug string) (*models.Page, error)
	UpdatePage(ctx context.Context, page *models.Page) error
	UpdatePageContent(ctx context.Context, id int64, content string) error
	DeletePage(ctx context.Context, id int64) error
	ListPages(ctx context.Context, sectionID int64) ([]models.Page, error)

	// Page Versions
	CreatePageVersion(ctx context.Context, version *models.PageVersion) error
	ListPageVersions(ctx context.Context, pageID int64) ([]models.PageVersion, error)
	GetPageVersion(ctx context.Context, pageID int64, versionNumber int) (*models.PageVersion, error)
	GetLatestVersionNumber(ctx context.Context, pageID int64) (int, error)

	// Comments
	CreateComment(ctx context.Context, comment *models.Comment) error
	GetCommentByID(ctx context.Context, id int64) (*models.Comment, error)
	DeleteComment(ctx context.Context, id int64) error
	ListComments(ctx context.Context, pageID int64) ([]models.Comment, error)

	// Progress
	MarkPageComplete(ctx context.Context, userID, pageID int64) error
	GetCourseProgress(ctx context.Context, userID, courseID int64) ([]models.Progress, error)

	// API Keys
	CreateAPIKey(ctx context.Context, key *models.APIKey) error
	GetUserByAPIKeyHash(ctx context.Context, keyHash string) (*models.User, error)
	ListAPIKeys(ctx context.Context, userID int64) ([]models.APIKey, error)
	DeleteAPIKey(ctx context.Context, id, userID int64) error

	// Tags
	GetOrCreateTag(ctx context.Context, name, slug, category string) (*models.Tag, error)
	AddCourseTag(ctx context.Context, courseID, tagID int64) error
	ListCourseTags(ctx context.Context, courseID int64) ([]models.Tag, error)
	ListTagsWithCounts(ctx context.Context) ([]models.Tag, error)

	// Search
	SearchCourses(ctx context.Context, query string, limit int) ([]models.CourseSummary, error)
	IndexCourseForSearch(ctx context.Context, courseID int64) error

	// Dashboard
	GetDashboard(ctx context.Context, userID int64) (*models.DashboardResponse, error)
	ListCoursesPaginated(ctx context.Context, page, size int, category, tag string, includeProtected bool) (*models.PaginatedCourses, error)

	// Course views
	RecordCourseView(ctx context.Context, userID, courseID int64) error

	// Enhanced progress
	GetCoursesInProgress(ctx context.Context, userID int64, limit int) ([]models.CourseSummary, error)
	GetAllCourseProgress(ctx context.Context, userID int64) (map[int64]int, error)

	// Stats
	GetStorageStats(ctx context.Context) (*models.StorageStats, error)
}
