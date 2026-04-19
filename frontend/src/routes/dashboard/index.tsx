import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { get } from "~/lib/api";
import type { DashboardData, CourseSummary, Tag } from "~/lib/types";
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
  const categories = [...new Set(allTags.value.map((t) => t.category))].sort();
  const visibleCategories = activeCategory.value
    ? sortedCategories.filter(([cat]) => cat === activeCategory.value)
    : sortedCategories;

  return (
    <div class="p-6 lg:px-8 lg:pb-16 max-w-[1500px]">
      {/* Page top */}
      <div class="flex items-center justify-between mb-[18px] gap-4">
        <div class="ln-breadcrumb">
          learn <span class="text-border">/</span> <b>library</b>
        </div>
        <div class="flex gap-2 items-center">
          {/* Search */}
          <div class="flex items-center gap-2 bg-surface border border-border-soft px-2.5 py-1.5 rounded-lg text-subtle font-mono text-[12px] w-[280px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              value={searchQuery.value}
              onInput$={onSearchInput}
              placeholder="Search courses..."
              class="bg-transparent border-0 outline-none text-text font-mono text-[12px] flex-1"
              autoComplete="off"
            />
            {searching.value && (
              <div class="w-3 h-3 border-[1.5px] border-accent border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          <Link href="/dashboard/courses/new" class="ln-btn ln-btn-primary text-[13px]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14m-7-7h14"/></svg>
            New Course
          </Link>
        </div>
      </div>

      {/* Greet */}
      <div class="ln-greet">
        <h1>
          Your Library{" "}
          {d && <em>{d.total_courses} courses</em>}
        </h1>
        <p class="text-muted text-[13.5px] flex gap-3.5 items-center mt-1">
          {d ? `${sortedCategories.length} topics` : "Loading..."}
          <span class="ln-liveping"><span class="d" /> live</span>
        </p>
      </div>

      {/* Error */}
      {error.value && (
        <div class="ln-panel mb-6">
          <div class="ln-panel-body text-failure text-[13px]">{error.value}</div>
        </div>
      )}

      {/* Loading */}
      {loading.value && (
        <div class="space-y-6 animate-pulse">
          <div class="ln-kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} class="ln-kpi"><div class="h-4 bg-border rounded w-20 mb-2" /><div class="h-8 bg-border rounded w-16" /></div>
            ))}
          </div>
          <div class="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} class="h-32 bg-border-soft rounded-xl" />)}
          </div>
        </div>
      )}

      {/* Search results */}
      {searchQuery.value.length >= 2 && (
        <div class="mb-8">
          <div class="ln-panel">
            <div class="ln-panel-head">
              <h3>
                Search Results
                <small>{searchResults.value.length} found</small>
              </h3>
            </div>
            <div class="ln-panel-body p0">
              {searchResults.value.length > 0 ? (
                <table class="ln-tbl">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Pages</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.value.map((course) => (
                      <tr key={course.id}>
                        <td>
                          <Link href={`/courses/${course.slug}/`} class="hover:text-accent transition-colors">
                            <b>{course.title}</b>
                            {course.description && (
                              <span class="block text-subtle text-[11px] font-mono mt-0.5 truncate max-w-[400px]">{course.description}</span>
                            )}
                          </Link>
                        </td>
                        <td class="mono">{course.total_pages || course.page_count || 0}</td>
                        <td>
                          {course.progress_pct > 0 ? (
                            <span class="ln-pill ok">{Math.round(course.progress_pct)}%</span>
                          ) : (
                            <span class="ln-pill plain">Not started</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div class="ln-panel-body text-subtle text-[13px]">No results for "{searchQuery.value}"</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dashboard content */}
      {d && searchQuery.value.length < 2 && (
        <>
          {/* Continue Learning */}
          {d.in_progress.length > 0 && (
            <div class="ln-panel mb-6">
              <div class="ln-panel-head">
                <h3>
                  Continue Learning
                  <small>{d.in_progress.length}</small>
                </h3>
              </div>
              <div class="ln-panel-body p0">
                {d.in_progress.map((course) => {
                  const readingMins = Math.max(1, Math.round((course.total_pages || 0) * 3));
                  const remaining = Math.round(readingMins * (1 - course.progress_pct / 100));
                  return (
                    <Link
                      key={course.id}
                      href={`/courses/${course.slug}/`}
                      class="flex items-center gap-4 px-[18px] py-3 border-b border-dashed border-border-soft last:border-0 hover:bg-[color-mix(in_oklch,var(--color-surface)_60%,var(--color-bg-2))] transition-colors"
                    >
                      <div class="w-[18px] h-[18px] rounded-full grid place-items-center text-[10px] bg-[color-mix(in_oklch,var(--color-accent)_22%,transparent)] text-accent shrink-0">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 6.253v13M6.5 5C5.254 5 4.168 5.477 3 6.253v13C4.168 18.477 5.254 18 6.5 18s3.332.477 4.5 1.253m0-13c1.168-.776 2.754-1.253 4.5-1.253s3.332.477 4.5 1.253v13c-1.168-.776-2.754-1.253-4.5-1.253s-3.332.477-4.5 1.253"/></svg>
                      </div>
                      <div class="flex-1 min-w-0">
                        <b class="text-[13px] font-medium">{course.title}</b>
                        <span class="text-subtle font-mono text-[10.5px] block mt-0.5">
                          {course.completed_pages} of {course.total_pages} pages &middot; ~{remaining}m left
                        </span>
                      </div>
                      <div class="w-24 shrink-0">
                        <div class="flex justify-between font-mono text-[10.5px] text-subtle mb-1">
                          <span>progress</span>
                          <span class="text-accent">{Math.round(course.progress_pct)}%</span>
                        </div>
                        <div class="ln-track">
                          <div style={{ width: `${course.progress_pct}%` }} />
                        </div>
                      </div>
                      {course.tags && course.tags.length > 0 && (
                        <div class="hidden xl:flex gap-1 shrink-0">
                          {course.tags.slice(0, 2).map((tag) => (
                            <TagBadge key={tag.id} name={tag.name} category={tag.category} />
                          ))}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recently Viewed */}
          {d.recently_viewed.length > 0 && (
            <div class="mb-6">
              <h2 class="font-mono text-[10.5px] text-subtle tracking-[0.1em] uppercase mb-3 px-1">Recently Viewed</h2>
              <div class="flex gap-3 overflow-x-auto pb-2">
                {d.recently_viewed.map((course) => (
                  <Link
                    key={course.id}
                    href={`/courses/${course.slug}/`}
                    class="shrink-0 flex items-center gap-3 px-3.5 py-2.5 bg-surface border border-border-soft rounded-[10px] hover:border-[color-mix(in_oklch,var(--color-accent)_35%,transparent)] transition-all group min-w-[220px]"
                  >
                    <div class="w-8 h-8 rounded-md bg-bg-2 border border-border-soft grid place-items-center text-muted group-hover:text-accent transition-colors font-mono text-[11px] font-medium">
                      {course.title.charAt(0).toUpperCase()}
                    </div>
                    <div class="min-w-0">
                      <p class="text-[12.5px] font-medium text-text truncate">{course.title}</p>
                      {course.progress_pct > 0 && (
                        <p class="text-[10.5px] text-subtle font-mono">{Math.round(course.progress_pct)}%</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div class="flex items-center gap-2 mb-5 overflow-x-auto pb-2 sticky top-[57px] bg-[color-mix(in_oklch,var(--color-bg)_95%,transparent)] backdrop-blur-sm z-30 py-3 -mx-6 px-6 lg:-mx-8 lg:px-8">
            <button
              onClick$={() => { activeCategory.value = ""; }}
              class={`ln-chip ${activeCategory.value === "" ? "active" : ""}`}
            >
              All Topics
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick$={() => { activeCategory.value = activeCategory.value === cat ? "" : cat; }}
                class={`ln-chip ${activeCategory.value === cat ? "active" : ""}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Category sections */}
          {visibleCategories.map(([category, courses]) => (
            <section key={category} class="mb-8">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-[14px] font-medium">{category}</h2>
                <span class="font-mono text-[10.5px] text-subtle">{courses.length} courses</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {courses.map((course) => (
                  <CourseListItem key={course.id} course={course} />
                ))}
              </div>
            </section>
          ))}

          {visibleCategories.length === 0 && !loading.value && (
            <div class="text-center py-16 text-subtle">
              No courses found in this category.
            </div>
          )}
        </>
      )}
    </div>
  );
});

const CourseListItem = component$<{ course: CourseSummary }>(({ course }) => {
  const pageCount = course.total_pages || course.page_count || 0;
  const readingMins = Math.max(1, Math.round(pageCount * 3));

  return (
    <Link
      href={`/courses/${course.slug}/`}
      class="ln-card block rounded-xl border border-border-soft bg-surface p-4 no-underline text-inherit cursor-pointer relative overflow-hidden"
    >
      {/* Progress indicator line at top */}
      {course.progress_pct > 0 && (
        <div class="absolute inset-x-0 top-0 h-[3px] bg-bg-2">
          <div
            class="h-full bg-accent transition-all duration-500"
            style={{ width: `${course.progress_pct}%` }}
          />
        </div>
      )}

      <div class="flex items-start justify-between gap-2 mb-2">
        <h3 class="text-[13px] font-medium text-text line-clamp-2 leading-snug">
          {course.title}
        </h3>
        {course.progress_pct > 0 && (
          <span class="ln-pill ok shrink-0">{Math.round(course.progress_pct)}%</span>
        )}
      </div>

      {course.description && (
        <p class="text-[11.5px] text-muted line-clamp-2 mb-3">{course.description}</p>
      )}

      {course.tags && course.tags.length > 0 && (
        <div class="flex flex-wrap gap-1 mb-3">
          {course.tags.slice(0, 2).map((tag) => (
            <TagBadge key={tag.id} name={tag.name} category={tag.category} />
          ))}
        </div>
      )}

      <div class="flex items-center gap-3 font-mono text-[11px] text-subtle mt-auto">
        <span class="flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {readingMins < 60 ? `${readingMins}m` : `${Math.floor(readingMins/60)}h ${readingMins%60}m`}
        </span>
        <span>{pageCount} pg</span>
      </div>
    </Link>
  );
});
