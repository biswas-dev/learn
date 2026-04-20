import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { useLocation, Link, type StaticGenerateHandler } from "@builder.io/qwik-city";

export const onStaticGenerate: StaticGenerateHandler = async () => {
  return { params: [{ courseSlug: "_" }] };
};
import { get } from "~/lib/api";
import type { Course, User } from "~/lib/types";
import {
  getCompletedPages,
  getBookmark,
  countPages,
  markPageRead,
} from "~/lib/progress";

/** Deterministic cover color from title */
function tintFor(title: string): string {
  const colors = ["#8A6B4A","#6A7F8C","#8C7A6B","#5E6E58","#8A5F5F","#6A5F8A","#7A8A4A","#4A6A7A","#9A7A4A","#6E5A7F"];
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

export default component$(() => {
  const loc = useLocation();
  const course = useSignal<Course | null>(null);
  const loading = useSignal(true);
  const error = useSignal("");
  const completedIds = useSignal<number[]>([]);
  const bookmark = useSignal<{ pageId: number; href: string; title: string } | null>(null);
  const totalPages = useSignal(0);
  const user = useSignal<User | null>(null);

  useVisibleTask$(() => {
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const coursesIdx = pathParts.indexOf("courses");
    const slug = coursesIdx >= 0 ? pathParts[coursesIdx + 1] : loc.params.courseSlug;
    if (!slug || slug === "_") return;
    get<Course>(`/courses/${slug}`)
      .then((data) => {
        course.value = data;
        if (data.sections) {
          totalPages.value = countPages(data.sections);
          const localDone = getCompletedPages(data.slug);
          completedIds.value = [...localDone];
          bookmark.value = getBookmark(data.slug);

          if (localStorage.getItem("learn_token")) {
            get<User>("/me").then((u) => { user.value = u; }).catch(() => {});
            get<{ page_id: number }[]>(`/courses/${data.id}/progress`)
              .then((serverProgress) => {
                if (serverProgress && serverProgress.length > 0) {
                  const merged = new Set(localDone);
                  for (const p of serverProgress) {
                    merged.add(p.page_id);
                    markPageRead(data.slug, p.page_id);
                  }
                  completedIds.value = [...merged];
                }
              })
              .catch(() => {});
          }
        }
      })
      .catch((err) => { error.value = err.message; })
      .finally(() => { loading.value = false; });
  });

  if (loading.value) {
    return (
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 32px" }}>
        <div class="animate-pulse">
          <div style={{ height: "32px", background: "var(--color-rule-soft)", borderRadius: "3px", width: "256px", marginBottom: "16px" }} />
          <div style={{ height: "16px", background: "var(--color-rule-soft)", borderRadius: "3px", width: "384px", marginBottom: "32px" }} />
          <div style={{ height: "300px", background: "var(--color-rule-soft)", borderRadius: "3px" }} />
        </div>
      </main>
    );
  }

  if (error.value || !course.value) {
    return (
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 32px" }}>
        <div class="ln-panel">
          <div class="ln-panel-body">
            <p style={{ color: "var(--color-failure)", fontSize: "13px" }}>{error.value || "Course not found"}</p>
            <Link href="/dashboard" style={{ color: "var(--color-accent-ink)", fontSize: "13px", marginTop: "8px", display: "inline-block" }}>Back to library</Link>
          </div>
        </div>
      </main>
    );
  }

  const c = course.value;
  const firstPage =
    c.sections?.[0]?.pages?.[0]
      ? `/courses/${c.slug}/${c.sections[0].slug}/${c.sections[0].pages[0].slug}`
      : null;

  const doneCount = completedIds.value.length;
  const pct = totalPages.value > 0 ? Math.round((doneCount / totalPages.value) * 100) : 0;
  const remaining = Math.max(1, Math.round((totalPages.value - doneCount) * 3));

  // Build flat chapter list from sections
  const chapters = (c.sections || []).map((sec, si) => {
    const sectionPages = sec.pages || [];
    const sectionDone = sectionPages.every((p) => completedIds.value.includes(p.id));
    const sectionPartial = sectionPages.some((p) => completedIds.value.includes(p.id));
    // Current section is the first non-complete section
    const isCurrent = !sectionDone && (si === 0 || (c.sections || []).slice(0, si).every((prev) =>
      (prev.pages || []).every((p) => completedIds.value.includes(p.id))
    ));
    return {
      n: si + 1,
      title: sec.title,
      slug: sec.slug,
      pages: sectionPages.length,
      done: sectionDone,
      partial: sectionPartial,
      current: isCurrent,
      firstPageSlug: sectionPages[0]?.slug,
    };
  });

  return (
    <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 32px 80px" }}>
      {/* Breadcrumb */}
      <div class="ln-breadcrumb" style={{ marginBottom: "24px" }}>
        <Link href="/dashboard">Library</Link>
        <span style={{ margin: "0 8px" }}>/</span>
        <span style={{ color: "var(--color-ink)" }}>{c.title}</span>
      </div>

      {/* Book hero */}
      <section style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "56px", marginBottom: "56px" }}>
        <div class="ln-cover ln-cover-lg" style={{ background: tintFor(c.title), height: "380px", maxWidth: "280px" }}>
          <div class="ln-cover-texture" />
          <div class="ln-cover-text" style={{ inset: "24px 18px", fontSize: "22px" }}>
            <div class="learn-label" style={{ fontSize: "10px" }}>Learn</div>
            <div style={{ textWrap: "pretty" }}>{c.title}</div>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <span class="ln-tag">{c.sections?.length || 0} chapters · {totalPages.value} pages</span>
          </div>
          <h1 class="serif" style={{ fontSize: "56px", margin: 0, lineHeight: 1, letterSpacing: "-0.02em", fontWeight: 400 }}>
            {c.title}
          </h1>
          {c.description && (
            <p style={{ fontSize: "16px", color: "var(--color-ink-2)", lineHeight: 1.55, maxWidth: "560px", marginTop: "20px" }}>
              {c.description}
            </p>
          )}

          {/* Stats panel */}
          <div style={{
            marginTop: "32px", padding: "20px",
            background: "var(--color-paper-2)", border: "1px solid var(--color-rule)", borderRadius: "3px",
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px",
          }}>
            <div>
              <div class="mono" style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>Progress</div>
              <div class="serif" style={{ fontSize: "28px", marginTop: "4px" }}>{pct}%</div>
              <div style={{ marginTop: "8px" }}><div class="ln-track"><div style={{ width: `${pct}%` }} /></div></div>
            </div>
            <div>
              <div class="mono" style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>Time left</div>
              <div class="serif" style={{ fontSize: "28px", marginTop: "4px" }}>{remaining}<span style={{ fontSize: "14px", color: "var(--color-ink-3)" }}> min</span></div>
              <div style={{ fontSize: "12px", color: "var(--color-ink-3)", marginTop: "8px" }}>{totalPages.value - doneCount} pages remaining</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              {bookmark.value ? (
                <Link href={bookmark.value.href} class="ln-btn ln-btn-primary">
                  Resume reading
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </Link>
              ) : firstPage ? (
                <Link href={firstPage} class="ln-btn ln-btn-primary">
                  Start reading
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </Link>
              ) : null}
            </div>
          </div>

          {/* Admin edit */}
          {user.value && (user.value.role === "admin" || user.value.role === "editor") && (
            <div style={{ marginTop: "16px" }}>
              <Link href={`/dashboard/courses/${c.id}`} class="ln-btn ln-btn-ghost" style={{ fontSize: "12px" }}>
                Edit course
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Table of contents */}
      <section>
        <div class="ln-section-header">
          <span class="label">TOC &nbsp;/&nbsp; Table of contents</span>
        </div>

        <div>
          {chapters.map((ch) => (
            <div key={ch.n} style={{
              display: "grid", gridTemplateColumns: "40px 1fr 80px 100px",
              gap: "20px", alignItems: "center",
              padding: "14px 4px", borderBottom: "1px solid var(--color-rule-soft)",
              opacity: ch.done ? 0.55 : 1,
              background: ch.current ? "var(--color-paper-2)" : "transparent",
              borderLeft: ch.current ? "2px solid var(--color-accent)" : "2px solid transparent",
              paddingLeft: "12px",
            }}>
              <span class="mono" style={{ fontSize: "11px", color: "var(--color-ink-3)" }}>
                {String(ch.n).padStart(2, "0")}
              </span>
              <div>
                <div class="serif" style={{ fontSize: "17px", lineHeight: 1.2, letterSpacing: "-0.005em" }}>
                  {ch.title}
                </div>
                {ch.current && (
                  <div style={{ fontSize: "11px", color: "var(--color-accent-ink)", marginTop: "3px", fontWeight: 500 }}>
                    Up next — you'll pick up here
                  </div>
                )}
              </div>
              <span class="mono" style={{ fontSize: "11px", color: "var(--color-ink-3)" }}>
                {ch.pages} pages
              </span>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                {ch.done ? (
                  <span class="mono" style={{ fontSize: "11px", color: "var(--color-ink-3)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
                    done
                  </span>
                ) : ch.current && ch.firstPageSlug ? (
                  <Link href={`/courses/${c.slug}/${ch.slug}/${ch.firstPageSlug}`} class="ln-btn ln-btn-primary" style={{ padding: "8px 14px", fontSize: "12px" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4"/></svg>
                    Read
                  </Link>
                ) : (
                  <span class="mono" style={{ fontSize: "11px", color: "var(--color-ink-4)" }}>—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
});
