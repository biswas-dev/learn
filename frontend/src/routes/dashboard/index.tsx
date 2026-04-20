import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { get } from "~/lib/api";
import type { DashboardData, CourseSummary, Tag } from "~/lib/types";

/** Deterministic cover color from title */
function tintFor(title: string): string {
  const colors = ["#8A6B4A","#6A7F8C","#8C7A6B","#5E6E58","#8A5F5F","#6A5F8A","#7A8A4A","#4A6A7A","#9A7A4A","#6E5A7F"];
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default component$(() => {
  const dashboard = useSignal<DashboardData | null>(null);
  const allTags = useSignal<Tag[]>([]);
  const loading = useSignal(true);
  const error = useSignal("");
  const activeCategory = useSignal("");
  const searchQuery = useSignal("");
  const searchResults = useSignal<CourseSummary[]>([]);
  const searching = useSignal(false);
  const userName = useSignal("reader");

  useVisibleTask$(() => {
    // Fetch user name
    const token = localStorage.getItem("learn_token");
    if (token) {
      fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : null)
        .then((u) => { if (u) userName.value = u.display_name || "reader"; })
        .catch(() => {});
    }

    Promise.all([
      get<DashboardData>("/dashboard"),
      get<Tag[]>("/tags"),
    ])
      .then(([d, t]) => {
        dashboard.value = d;
        allTags.value = t;
      })
      .catch((err) => { error.value = err.message; })
      .finally(() => { loading.value = false; });
  });

  const doSearch = $(async (q: string) => {
    if (q.length < 2) { searchResults.value = []; searching.value = false; return; }
    searching.value = true;
    try {
      const data = await get<CourseSummary[]>(`/courses/search?q=${encodeURIComponent(q)}&limit=12`);
      searchResults.value = data;
    } catch { searchResults.value = []; }
    finally { searching.value = false; }
  });

  const onSearchInput = $((e: InputEvent) => {
    const val = (e.target as HTMLInputElement).value;
    searchQuery.value = val;
    clearTimeout((window as any).__dashSearch);
    (window as any).__dashSearch = setTimeout(() => doSearch(val), 250);
  });

  const d = dashboard.value;
  const activeCourse = d?.in_progress?.[0];
  const otherInProgress = d?.in_progress?.slice(1) || [];
  const sortedCategories = d
    ? Object.entries(d.categories).sort((a, b) => b[1].length - a[1].length)
    : [];
  const categories = [...new Set(allTags.value.map((t) => t.category))].sort();
  const visibleCategories = activeCategory.value
    ? sortedCategories.filter(([cat]) => cat === activeCategory.value)
    : sortedCategories;

  const dateStr = new Date().toDateString().toUpperCase();

  return (
    <div style={{ background: "var(--color-paper)", minHeight: "100vh" }}>
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 32px 80px" }}>
        {/* Greeting */}
        <div class="mono" style={{ fontSize: "11px", color: "var(--color-ink-3)", letterSpacing: "0.14em", marginBottom: "12px" }}>
          {dateStr}
        </div>
        <h1 class="serif" style={{ fontSize: "44px", margin: 0, lineHeight: 1.05, letterSpacing: "-0.02em", fontWeight: 400 }}>
          {timeOfDayGreeting()}, {userName.value}.
        </h1>

        {activeCourse && (
          <p style={{ fontSize: "15.5px", color: "var(--color-ink-2)", maxWidth: "620px", marginTop: "14px", marginBottom: 0 }}>
            {activeCourse.progress_pct > 0 && (
              <>
                You're {Math.round(activeCourse.progress_pct)}% through <strong style={{ color: "var(--color-ink)" }}>{activeCourse.title}</strong> —{" "}
                about {Math.max(1, Math.round((activeCourse.total_pages - activeCourse.completed_pages) * 3))} minutes left.
              </>
            )}
          </p>
        )}

        {/* Error */}
        {error.value && (
          <div class="ln-panel" style={{ marginTop: "24px" }}>
            <div class="ln-panel-body" style={{ color: "var(--color-failure)", fontSize: "13px" }}>{error.value}</div>
          </div>
        )}

        {/* Loading */}
        {loading.value && (
          <div style={{ marginTop: "48px" }} class="animate-pulse">
            <div style={{ height: "300px", background: "var(--color-rule-soft)", borderRadius: "3px" }} />
          </div>
        )}

        {/* Search results */}
        {searchQuery.value.length >= 2 && (
          <div style={{ marginTop: "24px" }}>
            <div class="ln-panel">
              <div class="ln-panel-head">
                <h3>Search Results <small>{searchResults.value.length} found</small></h3>
              </div>
              <div class="ln-panel-body p0">
                {searchResults.value.length > 0 ? (
                  <table class="ln-tbl">
                    <thead><tr><th>Course</th><th>Pages</th><th>Progress</th></tr></thead>
                    <tbody>
                      {searchResults.value.map((course) => (
                        <tr key={course.id}>
                          <td>
                            <Link href={`/courses/${course.slug}/`} class="hover:opacity-75">
                              <b>{course.title}</b>
                            </Link>
                          </td>
                          <td class="mono">{course.total_pages || course.page_count || 0}</td>
                          <td>{course.progress_pct > 0 ? <span class="ln-pill ok">{Math.round(course.progress_pct)}%</span> : <span class="ln-pill plain">Not started</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div class="ln-panel-body" style={{ color: "var(--color-ink-3)", fontSize: "13px" }}>No results for "{searchQuery.value}"</div>
                )}
              </div>
            </div>
          </div>
        )}

        {d && searchQuery.value.length < 2 && (
          <>
            {/* HERO: Continue reading */}
            {activeCourse && (
              <section style={{ marginTop: "48px" }}>
                {/* Section header */}
                <div class="ln-section-header">
                  <span class="label">01 &nbsp;/&nbsp; Continue reading</span>
                  <div style={{ flex: 1 }} />
                  <Link href={`/courses/${activeCourse.slug}/`} class="mono" style={{ fontSize: "11px", color: "var(--color-ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    View book →
                  </Link>
                </div>

                <div class="dash-hero" style={{
                  display: "grid", gridTemplateColumns: "220px 1fr 220px", gap: "36px", alignItems: "stretch",
                }}>
                  {/* Cover */}
                  <div class="dash-cover" style={{ display: "flex", justifyContent: "flex-start" }}>
                    <Link href={`/courses/${activeCourse.slug}/`}>
                      <div class="ln-cover ln-cover-lg" style={{ background: tintFor(activeCourse.title) }}>
                        <div class="ln-cover-texture" />
                        <div class="ln-cover-text">
                          <div class="learn-label">Learn</div>
                          <div style={{ textWrap: "pretty" }}>{activeCourse.title}</div>
                        </div>
                      </div>
                    </Link>
                  </div>

                  {/* Content */}
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                        {activeCourse.tags?.slice(0, 1).map((tag) => (
                          <span key={tag.id} class="ln-tag">{tag.name}</span>
                        ))}
                        <span class="ln-tag">{activeCourse.completed_pages} of {activeCourse.total_pages} pages</span>
                      </div>
                      <h2 class="serif" style={{ fontSize: "34px", margin: 0, lineHeight: 1.1, letterSpacing: "-0.015em", fontWeight: 400, textWrap: "pretty" }}>
                        {activeCourse.title}
                      </h2>
                      {activeCourse.last_viewed_at && (
                        <div style={{ marginTop: "14px", fontSize: "13.5px", color: "var(--color-ink-3)" }}>
                          Last read {new Date(activeCourse.last_viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      )}

                      {/* Next up card */}
                      <div style={{
                        marginTop: "26px", padding: "18px 20px",
                        background: "var(--color-paper-2)", border: "1px solid var(--color-rule)", borderRadius: "3px",
                      }}>
                        <div class="mono" style={{ fontSize: "10.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: "8px" }}>
                          Continue where you left off
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--color-ink-2)" }}>
                          {activeCourse.total_pages - activeCourse.completed_pages} pages remaining · ~{Math.max(1, Math.round((activeCourse.total_pages - activeCourse.completed_pages) * 3))} minutes
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "10px", marginTop: "28px" }}>
                      <Link href={`/courses/${activeCourse.slug}/`} class="ln-btn ln-btn-primary">
                        Continue reading
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                      </Link>
                      <Link href={`/courses/${activeCourse.slug}/`} class="ln-btn ln-btn-ghost">Table of contents</Link>
                    </div>
                  </div>

                  {/* Side stats */}
                  <div class="dash-side" style={{
                    borderLeft: "1px solid var(--color-rule)", paddingLeft: "32px",
                    display: "flex", flexDirection: "column", gap: "24px",
                  }}>
                    <div>
                      <div class="mono" style={{ fontSize: "10.5px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: "10px" }}>
                        Book progress
                      </div>
                      <div class="serif" style={{ fontSize: "44px", lineHeight: 1, letterSpacing: "-0.02em" }}>
                        {Math.round(activeCourse.progress_pct)}<span style={{ fontSize: "20px", color: "var(--color-ink-3)" }}>%</span>
                      </div>
                      <div style={{ marginTop: "10px" }}>
                        <div class="ln-track"><div style={{ width: `${activeCourse.progress_pct}%` }} /></div>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--color-ink-3)", marginTop: "8px" }}>
                        {activeCourse.completed_pages} of {activeCourse.total_pages} pages
                      </div>
                    </div>

                    <div>
                      <div class="mono" style={{ fontSize: "10.5px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: "10px" }}>
                        Total courses
                      </div>
                      <div class="serif" style={{ fontSize: "44px", lineHeight: 1, letterSpacing: "-0.02em" }}>
                        {d.total_courses}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--color-ink-3)", marginTop: "8px" }}>
                        {d.in_progress.length} in progress
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Row 2: Also in progress + Library browse */}
            <section class="dash-row2" style={{
              marginTop: "64px",
              display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "48px",
            }}>
              {/* In progress */}
              <div>
                <div class="ln-section-header">
                  <span class="label">02 &nbsp;/&nbsp; Also in progress</span>
                  <div style={{ flex: 1 }} />
                  <Link href="/dashboard" class="mono" style={{ fontSize: "11px", color: "var(--color-ink-3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    All books →
                  </Link>
                </div>

                <div style={{ display: "flex", flexDirection: "column" }}>
                  {otherInProgress.slice(0, 4).map((b) => {
                    const remaining = Math.max(1, Math.round((b.total_pages - b.completed_pages) * 3));
                    return (
                      <Link key={b.id} href={`/courses/${b.slug}/`} style={{
                        display: "grid", gridTemplateColumns: "64px 1fr 100px 130px",
                        gap: "20px", alignItems: "center",
                        padding: "20px 0", borderBottom: "1px solid var(--color-rule-soft)",
                        textDecoration: "none", color: "inherit",
                      }}>
                        <div class="ln-cover ln-cover-sm" style={{ background: tintFor(b.title) }}>
                          <div class="ln-cover-texture" />
                        </div>
                        <div>
                          <div class="serif" style={{ fontSize: "21px", lineHeight: 1.15, letterSpacing: "-0.01em" }}>
                            {b.title}
                          </div>
                          <div style={{ display: "flex", gap: "12px", marginTop: "6px", fontSize: "12px", color: "var(--color-ink-3)" }}>
                            {b.tags?.[0] && <span>{b.tags[0].name}</span>}
                            <span>·</span>
                            <span>{b.total_pages - b.completed_pages} pages left</span>
                            <span>·</span>
                            <span>~{remaining}m</span>
                          </div>
                        </div>
                        <div class="mono" style={{ fontSize: "11px", color: "var(--color-ink-3)", textAlign: "right" }}>
                          {Math.round(b.progress_pct)}%
                        </div>
                        <div class="ln-track"><div style={{ width: `${b.progress_pct}%` }} /></div>
                      </Link>
                    );
                  })}

                  {otherInProgress.length === 0 && !activeCourse && (
                    <p style={{ color: "var(--color-ink-3)", fontSize: "13px", padding: "20px 0" }}>
                      No courses in progress yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Recent activity */}
              <div>
                <div class="ln-section-header">
                  <span class="label">03 &nbsp;/&nbsp; Recently viewed</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {d.recently_viewed.slice(0, 5).map((rv) => (
                    <Link key={rv.id} href={`/courses/${rv.slug}/`} style={{
                      display: "grid", gridTemplateColumns: "90px 1fr", gap: "12px", fontSize: "13px",
                      textDecoration: "none", color: "inherit",
                    }}>
                      <span class="mono" style={{ fontSize: "11px", color: "var(--color-ink-3)" }}>
                        {rv.last_viewed_at ? new Date(rv.last_viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                      </span>
                      <span style={{ color: "var(--color-ink-2)" }}>{rv.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            {/* Full library browse */}
            <section style={{ marginTop: "64px" }}>
              <div class="ln-section-header">
                <span class="label">Library &nbsp;·&nbsp; {d.total_courses} books</span>
                <div style={{ flex: 1 }} />
                {/* Search inline */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "6px 12px", border: "1px solid var(--color-rule)", borderRadius: "3px",
                  background: "var(--color-paper-2)", minWidth: "220px",
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                  <input
                    type="text"
                    value={searchQuery.value}
                    onInput$={onSearchInput}
                    placeholder="Find a book..."
                    style={{
                      border: "none", background: "transparent", outline: "none",
                      fontSize: "13px", color: "var(--color-ink)", flex: 1,
                    }}
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Topic filter */}
              <div style={{
                display: "flex", gap: "2px", flexWrap: "wrap",
                borderBottom: "1px solid var(--color-rule)", paddingBottom: 0, marginBottom: "32px",
              }}>
                <button
                  onClick$={() => { activeCategory.value = ""; }}
                  class={`ln-chip ${activeCategory.value === "" ? "active" : ""}`}
                >
                  All
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
                <section key={category} style={{ marginBottom: "48px" }}>
                  <div class="ln-section-header">
                    <span class="label">{category} ({courses.length})</span>
                  </div>
                  <div>
                    {courses.map((b) => (
                      <Link key={b.id} href={`/courses/${b.slug}/`} style={{
                        display: "grid", gridTemplateColumns: "48px 2fr 1fr 1fr 60px",
                        gap: "20px", alignItems: "center",
                        padding: "14px 4px", borderBottom: "1px solid var(--color-rule-soft)",
                        textDecoration: "none", color: "inherit",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter$={(e: MouseEvent) => { (e.currentTarget as HTMLElement).style.background = "var(--color-paper-2)"; }}
                      onMouseLeave$={(e: MouseEvent) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <div class="ln-cover ln-cover-sm" style={{ background: tintFor(b.title) }}>
                          <div class="ln-cover-texture" />
                        </div>
                        <div>
                          <div class="serif" style={{ fontSize: "17px", lineHeight: 1.2, letterSpacing: "-0.005em" }}>
                            {b.title}
                          </div>
                          <div style={{ fontSize: "11.5px", color: "var(--color-ink-3)", marginTop: "3px" }}>
                            {b.tags?.[0]?.name || category}
                          </div>
                        </div>
                        <div class="mono" style={{ fontSize: "11.5px", color: "var(--color-ink-3)" }}>
                          {b.total_pages || b.page_count || 0} pages
                        </div>
                        <div>
                          {b.progress_pct > 0 ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div class="ln-track" style={{ flex: 1 }}><div style={{ width: `${b.progress_pct}%` }} /></div>
                              <span class="mono" style={{ fontSize: "11px", color: "var(--color-ink-3)", minWidth: "30px", textAlign: "right" }}>
                                {Math.round(b.progress_pct)}%
                              </span>
                            </div>
                          ) : (
                            <span class="mono" style={{ fontSize: "11px", color: "var(--color-ink-4)" }}>— not started</span>
                          )}
                        </div>
                        <div style={{ textAlign: "right", color: "var(--color-ink-3)" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}

              {visibleCategories.length === 0 && !loading.value && (
                <div style={{ textAlign: "center", padding: "64px 0", color: "var(--color-ink-3)" }}>
                  No courses found in this category.
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
});
