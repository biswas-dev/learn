import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { get } from "~/lib/api";
import type { DashboardData, CourseSummary, Tag } from "~/lib/types";
import { ProgressBar } from "~/components/courses/ProgressBar";
import { TagBadge } from "~/components/courses/TagBadge";

export default component$(() => {
  const dashboard = useSignal<DashboardData | null>(null);
  const allTags = useSignal<Tag[]>([]);
  const loading = useSignal(true);
  const error = useSignal("");
  const activeCategory = useSignal("");
  const searchQuery = useSignal("");
  const searchResults = useSignal<CourseSummary[]>([]);
  const searching = useSignal(false);

  useVisibleTask$(() => {
    Promise.all([
      get<DashboardData>("/dashboard"),
      get<Tag[]>("/tags"),
    ])
      .then(([d, t]) => {
        dashboard.value = d;
        allTags.value = t;
      })
      .catch((err) => {
        error.value = err.message;
      })
      .finally(() => {
        loading.value = false;
      });
  });

  const doSearch = $(async (q: string) => {
    if (q.length < 2) {
      searchResults.value = [];
      searching.value = false;
      return;
    }
    searching.value = true;
    try {
      const data = await get<CourseSummary[]>(`/courses/search?q=${encodeURIComponent(q)}&limit=12`);
      searchResults.value = data;
    } catch {
      searchResults.value = [];
    } finally {
      searching.value = false;
    }
  });

  const onSearchInput = $((e: InputEvent) => {
    const val = (e.target as HTMLInputElement).value;
    searchQuery.value = val;
    clearTimeout((window as any).__dashSearch);
    (window as any).__dashSearch = setTimeout(() => doSearch(val), 250);
  });

  const d = dashboard.value;
  const sortedCategories = d
    ? Object.entries(d.categories).sort((a, b) => b[1].length - a[1].length)
    : [];

  // Unique category list from tags
  const categories = [...new Set(allTags.value.map((t) => t.category))].sort();

  // Filter categories if one is selected
  const visibleCategories = activeCategory.value
    ? sortedCategories.filter(([cat]) => cat === activeCategory.value)
    : sortedCategories;

  return (
    <div class="min-h-screen">
      {/* Hero header with search */}
      <div class="relative overflow-hidden border-b border-border">
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(129,140,248,0.08),transparent)]" />
        <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
          <div class="flex items-start justify-between mb-6">
            <div>
              <h1 class="text-3xl font-bold text-text">Your Library</h1>
              <p class="text-muted mt-1">
                {d ? `${d.total_courses} courses across ${sortedCategories.length} topics` : "Loading..."}
              </p>
            </div>
            <Link
              href="/dashboard/courses/new"
              class="shrink-0 flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent text-sm rounded-lg hover:bg-accent/20 transition-colors border border-accent/20"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m-7-7h14"/></svg>
              New Course
            </Link>
          </div>

          {/* Search bar — inline, prominent */}
          <div class="relative max-w-2xl">
            <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={searchQuery.value}
              onInput$={onSearchInput}
              placeholder="Search courses, topics, technologies..."
              class="w-full pl-12 pr-4 py-3 rounded-xl bg-elevated border border-border text-text placeholder-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 text-sm transition-all"
              autoComplete="off"
            />
            {searching.value && (
              <div class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>
      </div>

      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error */}
        {error.value && (
          <div class="p-4 rounded-lg bg-failure/10 text-failure text-sm mb-6">{error.value}</div>
        )}

        {/* Loading skeleton */}
        {loading.value && (
          <div class="space-y-8 animate-pulse">
            <div><div class="h-5 bg-border rounded w-48 mb-4"/><div class="flex gap-4">{[1,2,3].map(i=><div key={i} class="h-32 bg-border rounded-xl w-72 shrink-0"/>)}</div></div>
            <div><div class="h-5 bg-border rounded w-32 mb-4"/><div class="grid grid-cols-4 gap-4">{[1,2,3,4].map(i=><div key={i} class="h-40 bg-border rounded-xl"/>)}</div></div>
          </div>
        )}

        {/* Search results */}
        {searchQuery.value.length >= 2 && (
          <div class="mb-8">
            <h2 class="text-sm font-medium text-muted mb-3">
              {searchResults.value.length > 0 ? `${searchResults.value.length} results for "${searchQuery.value}"` : `No results for "${searchQuery.value}"`}
            </h2>
            {searchResults.value.length > 0 && (
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.value.map((course) => (
                  <CourseListItem key={course.id} course={course} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dashboard content — only show when not searching */}
        {d && searchQuery.value.length < 2 && (
          <>
            {/* Continue Learning — hero cards with progress */}
            {d.in_progress.length > 0 && (
              <section class="mb-10">
                <h2 class="text-lg font-bold text-text mb-4 flex items-center gap-2">
                  <span class="w-1.5 h-5 bg-accent rounded-full inline-block" />
                  Continue Learning
                </h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {d.in_progress.map((course) => (
                    <InProgressCard key={course.id} course={course} />
                  ))}
                </div>
              </section>
            )}

            {/* Recently Viewed — compact horizontal list */}
            {d.recently_viewed.length > 0 && (
              <section class="mb-10">
                <h2 class="text-sm font-medium text-muted uppercase tracking-wider mb-3">Recently Viewed</h2>
                <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                  {d.recently_viewed.map((course) => (
                    <Link
                      key={course.id}
                      href={`/courses/${course.slug}/`}
                      class="shrink-0 flex items-center gap-3 px-4 py-3 bg-elevated rounded-lg border border-border hover:border-accent/30 transition-all group min-w-[250px]"
                    >
                      <div class="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 text-accent group-hover:bg-accent/20 transition-colors">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 6.253v13M6.5 5C5.254 5 4.168 5.477 3 6.253v13C4.168 18.477 5.254 18 6.5 18s3.332.477 4.5 1.253m0-13c1.168-.776 2.754-1.253 4.5-1.253s3.332.477 4.5 1.253v13c-1.168-.776-2.754-1.253-4.5-1.253s-3.332.477-4.5 1.253"/></svg>
                      </div>
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-text truncate">{course.title}</p>
                        {course.progress_pct > 0 && (
                          <p class="text-xs text-muted">{Math.round(course.progress_pct)}% complete</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Category filter bar */}
            <div class="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-thin sticky top-14 bg-surface/95 backdrop-blur-sm z-30 py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <button
                onClick$={() => { activeCategory.value = ""; }}
                class={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeCategory.value === ""
                    ? "bg-accent text-white shadow-md shadow-accent/25"
                    : "bg-elevated text-muted hover:text-text border border-border hover:border-accent/30"
                }`}
              >
                All Topics
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick$={() => { activeCategory.value = activeCategory.value === cat ? "" : cat; }}
                  class={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                    activeCategory.value === cat
                      ? "bg-accent text-white shadow-md shadow-accent/25"
                      : "bg-elevated text-muted hover:text-text border border-border hover:border-accent/30"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Category sections */}
            {visibleCategories.map(([category, courses]) => (
              <section key={category} class="mb-10">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="text-base font-semibold text-text">{category}</h2>
                  <span class="text-xs text-muted">{courses.length} courses</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {courses.map((course) => (
                    <CourseListItem key={course.id} course={course} />
                  ))}
                </div>
              </section>
            ))}

            {visibleCategories.length === 0 && !loading.value && (
              <div class="text-center py-16 text-muted">
                No courses found in this category.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

// In-progress course card — prominent with progress
const InProgressCard = component$<{ course: CourseSummary }>(({ course }) => {
  const readingMins = Math.max(1, Math.round((course.total_pages || 0) * 3));
  const remaining = Math.round(readingMins * (1 - course.progress_pct / 100));

  return (
    <Link
      href={`/courses/${course.slug}/`}
      class="group relative block rounded-xl border border-border bg-elevated p-5 hover:border-accent/40 transition-all hover:shadow-lg hover:shadow-accent/5"
    >
      {/* Subtle gradient accent */}
      <div class="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent to-success rounded-t-xl opacity-60" />

      <div class="flex items-start justify-between mb-3">
        <h3 class="text-sm font-semibold text-text line-clamp-2 leading-snug pr-2 group-hover:text-accent transition-colors">
          {course.title}
        </h3>
        <span class="shrink-0 text-xs font-bold text-accent">{Math.round(course.progress_pct)}%</span>
      </div>

      <ProgressBar percent={course.progress_pct} height="h-1" />

      <div class="flex items-center justify-between mt-3 text-xs text-muted">
        <span>{course.completed_pages} of {course.total_pages} pages</span>
        <span>{remaining > 0 ? `~${remaining}m left` : "Almost done!"}</span>
      </div>

      {course.tags && course.tags.length > 0 && (
        <div class="flex gap-1 mt-3">
          {course.tags.slice(0, 2).map((tag) => (
            <TagBadge key={tag.id} name={tag.name} category={tag.category} />
          ))}
        </div>
      )}
    </Link>
  );
});

// Course list item — clean, compact card
const CourseListItem = component$<{ course: CourseSummary }>(({ course }) => {
  const pageCount = course.total_pages || course.page_count || 0;
  const readingMins = Math.max(1, Math.round(pageCount * 3));

  return (
    <Link
      href={`/courses/${course.slug}/`}
      class="group block rounded-xl border border-border bg-elevated p-4 hover:border-accent/30 transition-all hover:shadow-md hover:shadow-accent/5 relative overflow-hidden"
    >
      {/* Progress indicator line at top */}
      {course.progress_pct > 0 && (
        <div class="absolute inset-x-0 top-0 h-0.5 bg-border">
          <div
            class="h-full bg-accent transition-all duration-500"
            style={{ width: `${course.progress_pct}%` }}
          />
        </div>
      )}

      <h3 class="text-sm font-semibold text-text line-clamp-2 leading-snug mb-2 group-hover:text-accent transition-colors">
        {course.title}
      </h3>

      {course.description && (
        <p class="text-xs text-muted line-clamp-2 mb-3">{course.description}</p>
      )}

      {course.tags && course.tags.length > 0 && (
        <div class="flex flex-wrap gap-1 mb-3">
          {course.tags.slice(0, 2).map((tag) => (
            <TagBadge key={tag.id} name={tag.name} category={tag.category} />
          ))}
        </div>
      )}

      <div class="flex items-center gap-3 text-xs text-muted">
        <span class="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {readingMins < 60 ? `${readingMins}m` : `${Math.floor(readingMins/60)}h ${readingMins%60}m`}
        </span>
        <span>{pageCount} pages</span>
        {course.progress_pct > 0 && (
          <span class="text-accent font-medium">{Math.round(course.progress_pct)}%</span>
        )}
      </div>
    </Link>
  );
});
