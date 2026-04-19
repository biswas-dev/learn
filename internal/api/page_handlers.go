package api

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	gowiki "github.com/anchoo2kewl/go-wiki"
	"github.com/biswas-dev/learn/internal/models"
	"github.com/biswas-dev/learn/internal/store"
	"github.com/go-chi/chi/v5"
)

type PageHandler struct {
	store store.Store
	wiki  *gowiki.Wiki
}

func (h *PageHandler) Create(w http.ResponseWriter, r *http.Request) {
	sectionID, err := strconv.ParseInt(chi.URLParam(r, "sectionId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid section id", http.StatusBadRequest)
		return
	}

	user := UserFromCtx(r.Context())
	var req struct {
		Title     string `json:"title"`
		Content   string `json:"content"`
		SortOrder *int   `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Title == "" {
		jsonError(w, "title is required", http.StatusBadRequest)
		return
	}

	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	page := &models.Page{
		SectionID: sectionID,
		Title:     req.Title,
		Slug:      slugify(req.Title),
		Content:   req.Content,
		SortOrder: sortOrder,
		CreatedBy: user.ID,
	}
	if err := h.store.CreatePage(r.Context(), page); err != nil {
		jsonError(w, "failed to create page", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusCreated, page)
}

func (h *PageHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "pageId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid page id", http.StatusBadRequest)
		return
	}

	page, err := h.store.GetPageByID(r.Context(), id)
	if err != nil || page == nil {
		jsonError(w, "page not found", http.StatusNotFound)
		return
	}

	var req struct {
		Title     string `json:"title"`
		SortOrder *int   `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Title != "" {
		page.Title = req.Title
		page.Slug = slugify(req.Title)
	}
	if req.SortOrder != nil {
		page.SortOrder = *req.SortOrder
	}

	if err := h.store.UpdatePage(r.Context(), page); err != nil {
		jsonError(w, "failed to update page", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusOK, page)
}

func (h *PageHandler) UpdateContent(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "pageId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid page id", http.StatusBadRequest)
		return
	}

	user := UserFromCtx(r.Context())

	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Create version before updating
	page, err := h.store.GetPageByID(r.Context(), id)
	if err != nil || page == nil {
		jsonError(w, "page not found", http.StatusNotFound)
		return
	}

	// Only create version if content actually changed
	newHash := hashContent(req.Content)
	oldHash := hashContent(page.Content)
	if newHash != oldHash && page.Content != "" {
		vNum, _ := h.store.GetLatestVersionNumber(r.Context(), id)
		version := &models.PageVersion{
			PageID:        id,
			VersionNumber: vNum + 1,
			Content:       page.Content,
			ContentHash:   oldHash,
			CreatedBy:     user.ID,
		}
		h.store.CreatePageVersion(r.Context(), version)
	}

	if err := h.store.UpdatePageContent(r.Context(), id, req.Content); err != nil {
		jsonError(w, "failed to update content", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusOK, map[string]string{"message": "content updated"})
}

func (h *PageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "pageId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid page id", http.StatusBadRequest)
		return
	}
	if err := h.store.DeletePage(r.Context(), id); err != nil {
		jsonError(w, "failed to delete page", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

func (h *PageHandler) ListVersions(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "pageId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid page id", http.StatusBadRequest)
		return
	}
	versions, err := h.store.ListPageVersions(r.Context(), id)
	if err != nil {
		jsonError(w, "failed to list versions", http.StatusInternalServerError)
		return
	}
	if versions == nil {
		versions = []models.PageVersion{}
	}
	jsonResp(w, http.StatusOK, versions)
}

func (h *PageHandler) RestoreVersion(w http.ResponseWriter, r *http.Request) {
	pageID, err := strconv.ParseInt(chi.URLParam(r, "pageId"), 10, 64)
	if err != nil {
		jsonError(w, "invalid page id", http.StatusBadRequest)
		return
	}
	vNum, err := strconv.Atoi(chi.URLParam(r, "versionNum"))
	if err != nil {
		jsonError(w, "invalid version number", http.StatusBadRequest)
		return
	}

	version, err := h.store.GetPageVersion(r.Context(), pageID, vNum)
	if err != nil || version == nil {
		jsonError(w, "version not found", http.StatusNotFound)
		return
	}

	// Save current content as a new version before restoring
	user := UserFromCtx(r.Context())
	page, _ := h.store.GetPageByID(r.Context(), pageID)
	if page != nil {
		latestNum, _ := h.store.GetLatestVersionNumber(r.Context(), pageID)
		h.store.CreatePageVersion(r.Context(), &models.PageVersion{
			PageID:        pageID,
			VersionNumber: latestNum + 1,
			Content:       page.Content,
			ContentHash:   hashContent(page.Content),
			CreatedBy:     user.ID,
		})
	}

	if err := h.store.UpdatePageContent(r.Context(), pageID, version.Content); err != nil {
		jsonError(w, "failed to restore version", http.StatusInternalServerError)
		return
	}
	jsonResp(w, http.StatusOK, map[string]string{"message": "version restored"})
}

// GetPageContent returns a single page with rendered HTML for the reader view.
func (h *PageHandler) GetPageContent(w http.ResponseWriter, r *http.Request) {
	courseSlug := chi.URLParam(r, "courseSlug")
	sectionSlug := chi.URLParam(r, "sectionSlug")
	pageSlug := chi.URLParam(r, "pageSlug")

	course, err := h.store.GetCourseBySlug(r.Context(), courseSlug)
	if err != nil || course == nil {
		jsonError(w, "course not found", http.StatusNotFound)
		return
	}

	user := UserFromCtx(r.Context())
	if course.IsProtected {
		hasAccess := user != nil && user.Role == models.RoleAdmin
		if !hasAccess && user != nil {
			tags, _ := h.store.GetUserAccessTags(r.Context(), user.ID)
			courseTags, _ := h.store.ListCourseTags(r.Context(), course.ID)
			for _, ut := range tags {
				for _, ct := range courseTags {
					if ut.ID == ct.ID {
						hasAccess = true
						break
					}
				}
				if hasAccess {
					break
				}
			}
		}
		if !hasAccess {
			jsonError(w, "access denied", http.StatusForbidden)
			return
		}
	}
	if !course.IsPublished && (user == nil || user.Role.Level() < models.RoleEditor.Level()) {
		jsonError(w, "course not found", http.StatusNotFound)
		return
	}

	// Find section
	sections, err := h.store.ListSections(r.Context(), course.ID)
	if err != nil {
		jsonError(w, "failed to load sections", http.StatusInternalServerError)
		return
	}

	var targetSection *models.Section
	for _, sec := range sections {
		if sec.Slug == sectionSlug {
			targetSection = &sec
			break
		}
	}
	if targetSection == nil {
		jsonError(w, "section not found", http.StatusNotFound)
		return
	}

	page, err := h.store.GetPageBySlug(r.Context(), targetSection.ID, pageSlug)
	if err != nil || page == nil {
		jsonError(w, "page not found", http.StatusNotFound)
		return
	}

	// Render markdown to HTML
	if h.wiki != nil {
		page.ContentHTML = h.wiki.RenderContent(page.Content)
	}

	jsonResp(w, http.StatusOK, page)
}

func (h *PageHandler) WikiPreview(w http.ResponseWriter, r *http.Request) {
	if h.wiki != nil {
		h.wiki.PreviewHandler()(w, r)
		return
	}
	jsonError(w, "preview not available", http.StatusServiceUnavailable)
}

func hashContent(content string) string {
	h := sha256.Sum256([]byte(content))
	return fmt.Sprintf("%x", h[:8])
}
