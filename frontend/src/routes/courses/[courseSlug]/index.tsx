import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { useLocation, Link, type StaticGenerateHandler } from "@builder.io/qwik-city";

export const onStaticGenerate: StaticGenerateHandler = async () => {
  return { params: [{ courseSlug: "_" }] };
};
import { get } from "~/lib/api";
import type { Course } from "~/lib/types";
import { TableOfContents } from "~/components/courses/TableOfContents";
import {
  getCompletedPages,
  getBookmark,
  countPages,
} from "~/lib/progress";

export default component$(() => {
  const loc = useLocation();
  const course = useSignal<Course | null>(null);
  const loading = useSignal(true);
  const error = useSignal("");
  const completedIds = useSignal<number[]>([]);
  const bookmark = useSignal<{ pageId: number; href: string; title: string } | null>(null);
  const totalPages = useSignal(0);

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
          const done = getCompletedPages(data.slug);
          completedIds.value = [...done];
          bookmark.value = getBookmark(data.slug);
        }
      })
      .catch((err) => {
        error.value = err.message;
      })
      .finally(() => {
        loading.value = false;
      });
  });

  if (loading.value) {
    return (
      <main class="max-w-4xl mx-auto px-4 py-10">
        <p class="text-muted">Loading course...</p>
      </main>
    );
  }

  if (error.value || !course.value) {
    return (
      <main class="max-w-4xl mx-auto px-4 py-10">
        <p class="text-failure">{error.value || "Course not found"}</p>
        <Link href="/" class="text-accent text-sm mt-2 inline-block">
          Back to courses
        </Link>
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

  return (
    <main class="max-w-4xl mx-auto px-4 py-10">
      <div class="mb-8">
        {c.cover_image_url && (
          <img
            src={c.cover_image_url}
            alt={c.title}
            class="w-full h-48 object-cover rounded-lg mb-6"
            width={800}
            height={192}
          />
        )}
        <h1 class="text-3xl font-bold text-text">{c.title}</h1>
        {c.description && (
          <p class="text-muted mt-2">{c.description}</p>
        )}
        {c.author_name && (
          <p class="text-sm text-muted mt-1">by {c.author_name}</p>
        )}
      </div>

      {/* Progress bar */}
      {totalPages.value > 0 && doneCount > 0 && (
        <div class="mb-6">
          <div class="flex items-center justify-between text-sm mb-1.5">
            <span class="text-muted">
              {doneCount} of {totalPages.value} pages read
            </span>
            <span class="text-accent font-medium">{pct}%</span>
          </div>
          <div class="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              class="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div class="flex items-center gap-3 mb-8">
        {bookmark.value && (
          <Link
            href={bookmark.value.href}
            class="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            Continue Reading
          </Link>
        )}
        {firstPage && !bookmark.value && (
          <Link
            href={firstPage}
            class="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Start Reading
          </Link>
        )}
        {firstPage && bookmark.value && (
          <Link
            href={firstPage}
            class="inline-flex items-center gap-2 px-4 py-2 border border-border text-muted rounded-md text-sm font-medium hover:text-text hover:border-accent/50 transition-colors"
          >
            Start Over
          </Link>
        )}
      </div>

      {c.sections && c.sections.length > 0 && (
        <div class="border border-border rounded-lg bg-elevated p-6">
          <h2 class="text-lg font-semibold text-text mb-4">Table of Contents</h2>
          <TableOfContents
            courseSlug={c.slug}
            sections={c.sections}
            completedPageIds={completedIds.value}
          />
        </div>
      )}
    </main>
  );
});
