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
  const lightboxSrc = useSignal("");
  const lightboxAlt = useSignal("");
  const resolvedCourseSlug = useSignal(loc.params.courseSlug);
  const resolvedSectionSlug = useSignal(loc.params.sectionSlug);
  const resolvedPageSlug = useSignal(loc.params.pageSlug);
  const completedIds = useSignal<number[]>([]);
  const pageMarkedComplete = useSignal(false);
  const user = useSignal<User | null>(null);

  useImageLightbox(lightboxSrc, lightboxAlt);

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

    Promise.all([
      get<Course>(`/courses/${cs}`),
      get<Page>(`/courses/${cs}/sections/${ss}/pages/${ps}`),
    ])
      .then(([courseData, pageData]) => {
        course.value = courseData;
        page.value = pageData;

        // Save bookmark but DON'T mark as read yet — wait for 60% scroll
        saveBookmark(
          courseData.slug,
          pageData.id,
          `/courses/${cs}/${ss}/${ps}`,
          pageData.title,
        );
        // Load completed pages from localStorage
        const localCompleted = getCompletedPages(courseData.slug);
        completedIds.value = [...localCompleted];
        pageMarkedComplete.value = localCompleted.has(pageData.id);

        // Load user info + record course view + load server progress + comments
        if (localStorage.getItem("learn_token")) {
          get<User>("/me").then((u) => { user.value = u; }).catch(() => {});
          apiPost(`/courses/${courseData.id}/view`, {}).catch(() => {});

          // Merge server-side progress with localStorage
          get<{ user_id: number; page_id: number; completed_at: string }[]>(
            `/courses/${courseData.id}/progress`
          ).then((serverProgress) => {
            if (serverProgress && serverProgress.length > 0) {
              const merged = new Set(localCompleted);
              for (const p of serverProgress) {
                merged.add(p.page_id);
                // Sync to localStorage
                markPageRead(courseData.slug, p.page_id);
              }
              completedIds.value = [...merged];
            }
          }).catch(() => {});

          if (pageData.id) {
            get<Comment[]>(`/pages/${pageData.id}/comments`)
              .then((c) => {
                comments.value = c;
              })
              .catch(() => {});
          }
        }
      })
      .catch((err) => {
        error.value = err.message;
      })
      .finally(() => {
        loading.value = false;
      });
  });

  // Compute prev/next navigation
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

  if (loading.value) {
    return (
      <main class="max-w-7xl mx-auto px-4 py-10">
        <p class="text-muted">Loading page...</p>
      </main>
    );
  }

  if (error.value || !page.value) {
    return (
      <main class="max-w-7xl mx-auto px-4 py-10">
        <p class="text-failure">{error.value || "Page not found"}</p>
        <Link href={`/courses/${resolvedCourseSlug.value}`} class="text-accent text-sm mt-2 inline-block">
          Back to course
        </Link>
      </main>
    );
  }

  return (
    <main class="max-w-7xl mx-auto px-4 py-10">
      <div class="lg:flex lg:gap-8">
        {/* Sidebar TOC - hidden on mobile, toggle button shown */}
        <button
          class="lg:hidden mb-4 text-sm text-accent flex items-center gap-1"
          onClick$={() => {
            showToc.value = !showToc.value;
          }}
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
          Table of Contents
        </button>

        {course.value?.sections && (
          <aside
            class={[
              "lg:w-64 lg:shrink-0 lg:block mb-6 lg:mb-0",
              showToc.value ? "block" : "hidden",
            ]}
          >
            <div class="sticky top-20">
              <TableOfContents
                courseSlug={resolvedCourseSlug.value}
                sections={course.value.sections}
                currentPageSlug={resolvedPageSlug.value}
                completedPageIds={completedIds.value}
              />
            </div>
          </aside>
        )}

        {/* Page content */}
        <article class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-4 mb-6">
            <h1 class="text-2xl font-bold text-text">{page.value.title}</h1>
            {user.value && (user.value.role === "admin" || user.value.role === "editor") && course.value && page.value && (
              <Link
                href={`/dashboard/courses/${course.value.id}/sections/${page.value.section_id}/pages/${page.value.id}`}
                class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-accent bg-elevated border border-border rounded-lg hover:border-accent/30 transition-all"
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

          {/* Comments section */}
          {localStorage.getItem("learn_token") && (
            <section class="mt-10 pt-6 border-t border-border">
              <h3 class="text-lg font-semibold text-text mb-4">
                Comments ({comments.value.length})
              </h3>

              {comments.value.map((c) => (
                <div key={c.id} class="mb-4 p-4 bg-elevated border border-border rounded-md">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-sm font-medium text-text">{c.author_name}</span>
                    <span class="text-xs text-muted">
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p class="text-sm text-text">{c.content}</p>
                </div>
              ))}

              <form
                preventdefault:submit
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
                  class="w-full bg-surface border border-border rounded-md p-3 text-text text-sm focus:outline-none focus:border-accent min-h-[80px]"
                  placeholder="Leave a comment..."
                  value={commentText.value}
                  onInput$={(_, el) => {
                    commentText.value = el.value;
                  }}
                />
                <button
                  type="submit"
                  class="mt-2 px-4 py-1.5 bg-accent text-white text-sm rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50"
                  disabled={commentLoading.value}
                >
                  {commentLoading.value ? "Posting..." : "Post Comment"}
                </button>
              </form>
            </section>
          )}
        </article>
      </div>
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
    </main>
  );
});
