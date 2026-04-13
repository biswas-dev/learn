import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { useLocation, Link } from "@builder.io/qwik-city";
import { get, post as apiPost } from "~/lib/api";
import type { Course, Page, Comment } from "~/lib/types";
import { TableOfContents } from "~/components/courses/TableOfContents";
import { PageNavigation } from "~/components/courses/PageNavigation";
import { Lightbox, useImageLightbox } from "~/components/shared/Lightbox";

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

  const { courseSlug, sectionSlug, pageSlug } = loc.params;

  useImageLightbox(lightboxSrc, lightboxAlt);

  useVisibleTask$(({ track }) => {
    track(() => loc.params.pageSlug);
    loading.value = true;

    Promise.all([
      get<Course>(`/courses/${courseSlug}`),
      get<Page>(`/courses/${courseSlug}/sections/${sectionSlug}/pages/${pageSlug}`),
    ])
      .then(([courseData, pageData]) => {
        course.value = courseData;
        page.value = pageData;

        // Load comments if we have a page ID and a token
        if (pageData.id && localStorage.getItem("learn_token")) {
          get<Comment[]>(`/pages/${pageData.id}/comments`)
            .then((c) => {
              comments.value = c;
            })
            .catch(() => {});
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
        const href = `/courses/${courseSlug}/${section.slug}/${p.slug}`;
        allPages.push({ href, title: p.title });
        if (p.slug === pageSlug && section.slug === sectionSlug) {
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
        <Link href={`/courses/${courseSlug}`} class="text-accent text-sm mt-2 inline-block">
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
                courseSlug={courseSlug}
                sections={course.value.sections}
                currentPageSlug={pageSlug}
              />
            </div>
          </aside>
        )}

        {/* Page content */}
        <article class="flex-1 min-w-0">
          <h1 class="text-2xl font-bold text-text mb-6">{page.value.title}</h1>
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
      <Lightbox src={lightboxSrc} alt={lightboxAlt} />
    </main>
  );
});
