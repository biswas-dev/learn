package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/biswas-dev/learn/internal/store"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// tagCategoryMap maps lowercase tag names to categories.
var tagCategoryMap = map[string]string{
	// AI/ML
	"generative ai":             "AI/ML",
	"genai system design":       "AI/ML",
	"genai systems":             "AI/ML",
	"genai applications":        "AI/ML",
	"deep learning":             "AI/ML",
	"deep neural networks":      "AI/ML",
	"neural networks":           "AI/ML",
	"machine learning":          "AI/ML",
	"pytorch":                   "AI/ML",
	"keras":                     "AI/ML",
	"tensorflow":                "AI/ML",
	"computer vision":           "AI/ML",
	"nlp":                       "AI/ML",
	"natural language processing": "AI/ML",
	"ai":                        "AI/ML",
	"llm":                       "AI/ML",
	"large language models":     "AI/ML",
	"rag":                       "AI/ML",
	"distributed ml":            "AI/ML",
	"reinforcement learning":    "AI/ML",

	// System Design
	"system design":             "System Design",
	"distributed systems":       "System Design",
	"microservices":             "System Design",
	"scalability":               "System Design",
	"architecture":              "System Design",
	"design patterns":           "System Design",

	// Web Frontend
	"react":                     "Web Frontend",
	"angular":                   "Web Frontend",
	"vue":                       "Web Frontend",
	"vue.js":                    "Web Frontend",
	"svelte":                    "Web Frontend",
	"css":                       "Web Frontend",
	"html":                      "Web Frontend",
	"tailwind":                  "Web Frontend",
	"next.js":                   "Web Frontend",
	"astro":                     "Web Frontend",
	"frontend":                  "Web Frontend",

	// Web Backend
	"node.js":                   "Web Backend",
	"express":                   "Web Backend",
	"django":                    "Web Backend",
	"flask":                     "Web Backend",
	"spring boot":               "Web Backend",
	"asp.net":                   "Web Backend",
	"graphql":                   "Web Backend",
	"rest api":                  "Web Backend",
	"api":                       "Web Backend",

	// DevOps/Cloud
	"aws":                       "DevOps/Cloud",
	"azure":                     "DevOps/Cloud",
	"gcp":                       "DevOps/Cloud",
	"docker":                    "DevOps/Cloud",
	"kubernetes":                "DevOps/Cloud",
	"terraform":                 "DevOps/Cloud",
	"ansible":                   "DevOps/Cloud",
	"ci/cd":                     "DevOps/Cloud",
	"devops":                    "DevOps/Cloud",
	"helm":                      "DevOps/Cloud",
	"jenkins":                   "DevOps/Cloud",
	"linux":                     "DevOps/Cloud",
	"nginx":                     "DevOps/Cloud",
	"cloud":                     "DevOps/Cloud",

	// Languages
	"javascript":                "Languages",
	"typescript":                "Languages",
	"python":                    "Languages",
	"java":                      "Languages",
	"go":                        "Languages",
	"golang":                    "Languages",
	"rust":                      "Languages",
	"c++":                       "Languages",
	"c#":                        "Languages",
	"ruby":                      "Languages",
	"kotlin":                    "Languages",
	"swift":                     "Languages",
	"elixir":                    "Languages",
	"scala":                     "Languages",
	"php":                       "Languages",
	"r":                         "Languages",

	// Security
	"security":                  "Security",
	"oauth":                     "Security",
	"oauth2":                    "Security",
	"authentication":            "Security",
	"cybersecurity":             "Security",
	"encryption":                "Security",
	"penetration testing":       "Security",

	// Data/Analytics
	"data science":              "Data/Analytics",
	"data engineering":          "Data/Analytics",
	"pandas":                    "Data/Analytics",
	"spark":                     "Data/Analytics",
	"kafka":                     "Data/Analytics",
	"data analysis":             "Data/Analytics",
	"big data":                  "Data/Analytics",
	"etl":                       "Data/Analytics",

	// Databases
	"sql":                       "Databases",
	"nosql":                     "Databases",
	"mongodb":                   "Databases",
	"postgresql":                "Databases",
	"mysql":                     "Databases",
	"redis":                     "Databases",
	"dynamodb":                  "Databases",
	"sqlite":                    "Databases",
	"elasticsearch":             "Databases",
	"neo4j":                     "Databases",

	// Testing
	"testing":                   "Testing",
	"unit testing":              "Testing",
	"test-driven development":   "Testing",
	"tdd":                       "Testing",
	"selenium":                  "Testing",
	"cypress":                   "Testing",
	"jest":                      "Testing",
	"junit":                     "Testing",

	// Interviews
	"interview":                 "Interviews",
	"interview prep":            "Interviews",
	"coding interview":          "Interviews",
	"behavioral interview":      "Interviews",
	"system design interview":   "Interviews",

	// Mobile
	"android":                   "Mobile",
	"ios":                       "Mobile",
	"react native":              "Mobile",
	"flutter":                   "Mobile",
	"mobile":                    "Mobile",
}

type catalogFile struct {
	Total      int             `json:"total"`
	Downloaded int             `json:"downloaded"`
	Pending    int             `json:"pending"`
	Courses    []catalogCourse `json:"courses"`
}

type catalogCourse struct {
	ID         int64    `json:"id"`
	AuthorID   int64    `json:"author_id"`
	Slug       string   `json:"slug"`
	Title      string   `json:"title"`
	Tags       []string `json:"tags"`
	Status     string   `json:"status"`
	PageCount  int      `json:"page_count"`
}

func categorize(tagName string) string {
	lower := strings.ToLower(strings.TrimSpace(tagName))
	if cat, ok := tagCategoryMap[lower]; ok {
		return cat
	}
	// Try partial match
	for key, cat := range tagCategoryMap {
		if strings.Contains(lower, key) || strings.Contains(key, lower) {
			return cat
		}
	}
	return "General"
}

func slugifyTag(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	s = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			return r
		}
		return '-'
	}, s)
	// collapse multiple dashes
	for strings.Contains(s, "--") {
		s = strings.ReplaceAll(s, "--", "-")
	}
	return strings.Trim(s, "-")
}

func main() {
	zerolog.SetGlobalLevel(zerolog.InfoLevel)
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	dbPath := os.Getenv("LEARN_DB_PATH")
	if dbPath == "" {
		dbPath = "learn.db"
	}

	catalogPath := filepath.Join(os.Getenv("HOME"), ".config/go-educative/catalog.json")
	if v := os.Getenv("CATALOG_PATH"); v != "" {
		catalogPath = v
	}

	// Open store
	s, err := store.NewSQLite(dbPath)
	if err != nil {
		log.Fatal().Err(err).Msg("open store")
	}
	defer s.Close()

	// Read catalog
	data, err := os.ReadFile(catalogPath)
	if err != nil {
		log.Fatal().Err(err).Str("path", catalogPath).Msg("read catalog")
	}
	var catalog catalogFile
	if err := json.Unmarshal(data, &catalog); err != nil {
		log.Fatal().Err(err).Msg("parse catalog")
	}

	ctx := context.Background()

	// Get all courses from DB
	courses, err := s.ListCourses(ctx, true, 0, true)
	if err != nil {
		log.Fatal().Err(err).Msg("list courses from DB")
	}
	courseBySlug := make(map[string]int64)
	for _, c := range courses {
		courseBySlug[c.Slug] = c.ID
	}

	log.Info().Int("catalog_courses", len(catalog.Courses)).Int("db_courses", len(courses)).Msg("loaded")

	tagCount := 0
	courseTagCount := 0

	for _, cc := range catalog.Courses {
		if len(cc.Tags) == 0 {
			continue
		}

		// Find matching course in DB
		courseID, ok := courseBySlug[cc.Slug]
		if !ok {
			continue
		}

		for _, tagName := range cc.Tags {
			tagName = strings.TrimSpace(tagName)
			if tagName == "" {
				continue
			}
			slug := slugifyTag(tagName)
			if slug == "" {
				continue
			}
			category := categorize(tagName)

			tag, err := s.GetOrCreateTag(ctx, tagName, slug, category)
			if err != nil {
				log.Warn().Err(err).Str("tag", tagName).Msg("create tag")
				continue
			}
			tagCount++

			if err := s.AddCourseTag(ctx, courseID, tag.ID); err != nil {
				log.Warn().Err(err).Str("tag", tagName).Int64("course", courseID).Msg("add course tag")
				continue
			}
			courseTagCount++
		}
	}

	log.Info().Int("tags_processed", tagCount).Int("course_tags", courseTagCount).Msg("tags backfilled")

	// Also try to infer tags from title for courses without tags
	for _, c := range courses {
		existing, _ := s.ListCourseTags(ctx, c.ID)
		if len(existing) > 0 {
			continue
		}
		// Try to match title words against known tags
		titleLower := strings.ToLower(c.Title)
		for key, cat := range tagCategoryMap {
			if strings.Contains(titleLower, key) {
				slug := slugifyTag(key)
				tag, err := s.GetOrCreateTag(ctx, key, slug, cat)
				if err == nil {
					s.AddCourseTag(ctx, c.ID, tag.ID)
				}
				break // one inferred tag is enough
			}
		}
	}

	// Rebuild FTS index
	log.Info().Msg("rebuilding FTS index...")
	if err := s.IndexAllCoursesForSearch(ctx); err != nil {
		log.Fatal().Err(err).Msg("rebuild FTS index")
	}

	// Final stats
	tags, _ := s.ListTagsWithCounts(ctx)
	log.Info().Int("unique_tags", len(tags)).Msg("backfill complete")

	fmt.Println("\nTop tags:")
	for i, t := range tags {
		if i >= 20 {
			break
		}
		fmt.Printf("  %-30s %-20s %d courses\n", t.Name, "["+t.Category+"]", t.Count)
	}
}
