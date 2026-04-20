import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { useLocation, Link, type StaticGenerateHandler } from "@builder.io/qwik-city";

export const onStaticGenerate: StaticGenerateHandler = async () => {
  return { params: [{ courseSlug: "_", sectionSlug: "_", pageSlug: "_" }] };
};
import { get, post as apiPost } from "~/lib/api";
import type { Course, Page, Comment, User } from "~/lib/types";
import { TableOfContents } from "~/components/courses/TableOfContents";
import { PageNavigation } from "~/components/courses/PageNavigation";
import { Lightbox, useImageLightbox } from "~/components/shared/Lightbox";
import {
  markPageRead,
  saveBookmark,
  getCompletedPages,
} from "~/lib/progress";
import { ReadingProgress } from "~/components/shared/ReadingProgress";

export default component$(() => {
  const loc = useLocation();
  const course = useSignal<Course | null>(null);
  const page = useSignal<Page | null>(null);
  const comments = useSignal<Comment[]>([]);
  const loading = useSignal(true);
  const error = useSignal("");
  const commentText = useSignal("");
  const commentLoading = useSignal(false);
  const showToc = useSignal(false);
  const pinToc = useSignal(false);
  const lightboxSrc = useSignal("");
  const lightboxAlt = useSignal("");
  const resolvedCourseSlug = useSignal(loc.params.courseSlug);
  const resolvedSectionSlug = useSignal(loc.params.sectionSlug);
  const resolvedPageSlug = useSignal(loc.params.pageSlug);
  const completedIds = useSignal<number[]>([]);
  const pageMarkedComplete = useSignal(false);
  const user = useSignal<User | null>(null);

  useImageLightbox(lightboxSrc, lightboxAlt);

  // Open TOC when mouse moves to the left edge of the browser
  useVisibleTask$(({ cleanup }) => {
    const onMouseMove = (e: MouseEvent) => {
      if (e.clientX <= 8 && !showToc.value && !pinToc.value) {
        showToc.value = true;
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    cleanup(() => window.removeEventListener("mousemove", onMouseMove));
  });

  useVisibleTask$(({ track }) => {
    track(() => loc.url.pathname);
    const parts = window.location.pathname.split("/").filter(Boolean);
    const ci = parts.indexOf("courses");
    const cs = ci >= 0 ? parts[ci + 1] : loc.params.courseSlug;
    const ss = ci >= 0 ? parts[ci + 2] : loc.params.sectionSlug;
    const ps = ci >= 0 ? parts[ci + 3] : loc.params.pageSlug;
    if (!cs || cs === "_" || !ss || !ps) return;
    resolvedCourseSlug.value = cs;
    resolvedSectionSlug.value = ss;
    resolvedPageSlug.value = ps;
    loading.value = true;

    // Restore pinned state from localStorage
    const savedPin = localStorage.getItem("learn_toc_pinned");
    if (savedPin === "true") {
      pinToc.value = true;
      showToc.value = true;
    }

    Promise.all([
      get<Course>(`/courses/${cs}`),
      get<Page>(`/courses/${cs}/sections/${ss}/pages/${ps}`),
    ])
      .then(([courseData, pageData]) => {
        course.value = courseData;
        page.value = pageData;

        saveBookmark(
          courseData.slug,
          pageData.id,
          `/courses/${cs}/${ss}/${ps}`,
          pageData.title,
        );
        const localCompleted = getCompletedPages(courseData.slug);
        completedIds.value = [...localCompleted];
        pageMarkedComplete.value = localCompleted.has(pageData.id);

        if (localStorage.getItem("learn_token")) {
          get<User>("/me").then((u) => { user.value = u; }).catch(() => {});
          apiPost(`/courses/${courseData.id}/view`, {}).catch(() => {});

          get<{ user_id: number; page_id: number; completed_at: string }[]>(
            `/courses/${courseData.id}/progress`
          ).then((serverProgress) => {
            if (serverProgress && serverProgress.length > 0) {
              const merged = new Set(localCompleted);
              for (const p of serverProgress) {
                merged.add(p.page_id);
                markPageRead(courseData.slug, p.page_id);
              }
              completedIds.value = [...merged];
            }
          }).catch(() => {});

          if (pageData.id) {
            get<Comment[]>(`/pages/${pageData.id}/comments`)
              .then((c) => { comments.value = c; })
              .catch(() => {});
          }
        }
      })
      .catch((err) => { error.value = err.message; })
      .finally(() => { loading.value = false; });
  });

  const prevNext = (() => {
    if (!course.value?.sections) return { prev: undefined, next: undefined };
    const allPages: { href: string; title: string }[] = [];
    let currentIdx = -1;
    for (const section of course.value.sections) {
      for (const p of section.pages ?? []) {
        const href = `/courses/${resolvedCourseSlug.value}/${section.slug}/${p.slug}`;
        allPages.push({ href, title: p.title });
        if (p.slug === resolvedPageSlug.value && section.slug === resolvedSectionSlug.value) {
          currentIdx = allPages.length - 1;
        }
      }
    }
    return {
      prev: currentIdx > 0 ? allPages[currentIdx - 1] : undefined,
      next: currentIdx < allPages.length - 1 ? allPages[currentIdx + 1] : undefined,
    };
  })();

  const tocVisible = showToc.value || pinToc.value;

  if (loading.value) {
    return (
      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 32px" }}>
        <div class="animate-pulse">
          <div style={{ height: "24px", background: "var(--color-rule-soft)", borderRadius: "3px", width: "192px", marginBottom: "16px" }} />
          <div style={{ height: "16px", background: "var(--color-rule-soft)", borderRadius: "3px", width: "100%", marginBottom: "8px" }} />
          <div style={{ height: "16px", background: "var(--color-rule-soft)", borderRadius: "3px", width: "75%", marginBottom: "8px" }} />
          <div style={{ height: "16px", background: "var(--color-rule-soft)", borderRadius: "3px", width: "83%" }} />
        </div>
      </main>
    );
  }

  if (error.value || !page.value) {
    return (
      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 32px" }}>
        <div class="ln-panel">
          <div class="ln-panel-body">
            <p style={{ color: "var(--color-failure)", fontSize: "13px" }}>{error.value || "Page not found"}</p>
            <Link href={`/courses/${resolvedCourseSlug.value}`} style={{ color: "var(--color-accent-ink)", fontSize: "13px", marginTop: "8px", display: "inline-block" }}>
              Back to course
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 32px 80px" }}>
        {/* Breadcrumb */}
        <div class="ln-breadcrumb" style={{ marginBottom: "24px" }}>
          <Link href="/dashboard">learn</Link>
          <span style={{ margin: "0 8px" }}>/</span>
          <Link href={`/courses/${resolvedCourseSlug.value}`}>
            {course.value?.title}
          </Link>
          <span style={{ margin: "0 8px" }}>/</span>
          <b style={{ maxWidth: "300px", display: "inline-block" }} class="truncate">{page.value.title}</b>
        </div>

        {/* Page content — full width */}
        <article>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "24px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>{page.value.title}</h1>
            {user.value && (user.value.role === "admin" || user.value.role === "editor") && course.value && page.value && (
              <Link
                href={`/dashboard/courses/${course.value.id}/sections/${page.value.section_id}/pages/${page.value.id}`}
                class="ln-btn ln-btn-ghost"
                style={{ fontSize: "12px", flexShrink: 0 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </Link>
            )}
          </div>

          <div
            class="ln-prose"
            dangerouslySetInnerHTML={page.value.content_html || ""}
          />

          <PageNavigation prev={prevNext.prev} next={prevNext.next} />

          {/* Comments */}
          {localStorage.getItem("learn_token") && (
            <section style={{ marginTop: "40px", paddingTop: "24px", borderTop: "1px solid var(--color-rule-soft)" }}>
              <div class="ln-panel">
                <div class="ln-panel-head">
                  <h3>Comments <small>{comments.value.length}</small></h3>
                </div>
                <div class="ln-panel-body p0">
                  {comments.value.map((c) => (
                    <div key={c.id} style={{ padding: "12px 18px", borderBottom: "1px dashed var(--color-rule-soft)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <div style={{
                          width: "24px", height: "24px", borderRadius: "3px",
                          background: "var(--color-paper-2)", border: "1px solid var(--color-rule)",
                          display: "grid", placeItems: "center",
                          fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 500,
                        }}>
                          {c.author_name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 500 }}>{c.author_name}</span>
                        <span class="mono" style={{ fontSize: "11px", color: "var(--color-ink-3)" }}>
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p style={{ fontSize: "13px", color: "var(--color-ink-2)", margin: 0 }}>{c.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              <form
                preventdefault:submit
                style={{ marginTop: "16px" }}
                onSubmit$={async () => {
                  if (!commentText.value.trim() || !page.value) return;
                  commentLoading.value = true;
                  try {
                    const newComment = await apiPost<Comment>(
                      `/pages/${page.value.id}/comments`,
                      { content: commentText.value },
                    );
                    comments.value = [...comments.value, newComment];
                    commentText.value = "";
                  } catch {
                    // silently fail
                  } finally {
                    commentLoading.value = false;
                  }
                }}
              >
                <textarea
                  class="ln-input"
                  style={{ minHeight: "80px", resize: "vertical" }}
                  placeholder="Leave a comment..."
                  value={commentText.value}
                  onInput$={(_, el) => { commentText.value = el.value; }}
                />
                <button
                  type="submit"
                  class="ln-btn ln-btn-primary"
                  style={{ marginTop: "8px", fontSize: "13px" }}
                  disabled={commentLoading.value}
                >
                  {commentLoading.value ? "Posting..." : "Post Comment"}
                </button>
              </form>
            </section>
          )}
        </article>
      </main>

      {/* TOC toggle button — fixed bottom-left */}
      {course.value?.sections && (
        <button
          onClick$={() => {
            if (pinToc.value) {
              // Unpin and close
              pinToc.value = false;
              showToc.value = false;
              localStorage.setItem("learn_toc_pinned", "false");
            } else {
              showToc.value = !showToc.value;
            }
          }}
          style={{
            position: "fixed",
            bottom: "16px",
            left: "16px",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 14px",
            background: tocVisible ? "var(--color-ink)" : "var(--color-paper-2)",
            color: tocVisible ? "var(--color-paper)" : "var(--color-ink-3)",
            border: tocVisible ? "none" : "1px solid var(--color-rule)",
            borderRadius: "999px",
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            boxShadow: "0 4px 20px -8px rgba(0,0,0,0.2)",
            transition: "all 0.15s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4zM18 20V8"/>
          </svg>
          {tocVisible ? "Close" : "Contents"}
          {pinToc.value && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <circle cx="12" cy="12" r="4"/>
            </svg>
          )}
        </button>
      )}

      {/* Sliding TOC panel */}
      {course.value?.sections && tocVisible && (
        <>
          {/* Backdrop (only when not pinned) */}
          {!pinToc.value && (
            <div
              onClick$={() => { showToc.value = false; }}
              style={{
                position: "fixed", inset: 0, zIndex: 44,
                background: "rgba(0,0,0,0.15)",
              }}
            />
          )}

          <aside style={{
            position: "fixed",
            top: "57px",
            left: 0,
            bottom: 0,
            width: "320px",
            zIndex: 45,
            background: "var(--color-paper)",
            borderRight: "1px solid var(--color-rule)",
            overflowY: "auto",
            boxShadow: pinToc.value ? "none" : "4px 0 20px -4px rgba(0,0,0,0.1)",
            transition: "box-shadow 0.15s",
          }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "1px solid var(--color-rule)",
              position: "sticky", top: 0, background: "var(--color-paper)", zIndex: 1,
            }}>
              <span class="mono" style={{ fontSize: "10.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>
                Table of Contents
              </span>
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                {/* Pin toggle icon */}
                <button
                  onClick$={() => {
                    pinToc.value = !pinToc.value;
                    localStorage.setItem("learn_toc_pinned", pinToc.value ? "true" : "false");
                    if (pinToc.value) showToc.value = true;
                  }}
                  title={pinToc.value ? "Unpin sidebar" : "Pin sidebar"}
                  style={{
                    padding: "6px", borderRadius: "3px",
                    background: pinToc.value ? "var(--color-ink)" : "transparent",
                    color: pinToc.value ? "var(--color-paper)" : "var(--color-ink-3)",
                    display: "grid", placeItems: "center",
                    transition: "all 0.15s",
                    transform: pinToc.value ? "rotate(0deg)" : "rotate(45deg)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2v8M15 5l-3 3-3-3M9 13h6M10 13v5a2 2 0 0 0 4 0v-5M12 18v4"/>
                  </svg>
                </button>
                {/* Close button */}
                <button
                  onClick$={() => {
                    showToc.value = false;
                    pinToc.value = false;
                    localStorage.setItem("learn_toc_pinned", "false");
                  }}
                  style={{
                    padding: "6px", borderRadius: "3px",
                    color: "var(--color-ink-3)", fontSize: "11px",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Course link */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--color-rule-soft)" }}>
              <Link
                href={`/courses/${resolvedCourseSlug.value}`}
                style={{ fontSize: "13px", color: "var(--color-accent-ink)", fontWeight: 500 }}
              >
                ← Back to overview
              </Link>
            </div>

            {/* TOC content */}
            <div style={{ padding: "12px 20px 24px" }}>
              <TableOfContents
                courseSlug={resolvedCourseSlug.value}
                sections={course.value.sections}
                currentPageSlug={resolvedPageSlug.value}
                completedPageIds={completedIds.value}
              />
            </div>
          </aside>
        </>
      )}

      <ReadingProgress
        threshold={60}
        isComplete={pageMarkedComplete.value || (page.value ? completedIds.value.includes(page.value.id) : false)}
        onComplete$={() => {
          if (page.value && course.value && !pageMarkedComplete.value) {
            pageMarkedComplete.value = true;
            markPageRead(course.value.slug, page.value.id);
            completedIds.value = [...getCompletedPages(course.value.slug)];
            if (localStorage.getItem("learn_token")) {
              apiPost(`/pages/${page.value.id}/complete`, {}).catch(() => {});
            }
          }
        }}
      />
      <Lightbox src={lightboxSrc} alt={lightboxAlt} />
    </>
  );
});
