import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { useLocation, Link, type StaticGenerateHandler } from "@builder.io/qwik-city";

export const onStaticGenerate: StaticGenerateHandler = async () => {
  return { params: [{ courseSlug: "_" }] };
};
import { get } from "~/lib/api";
import type { Course, User } from "~/lib/types";
import { TableOfContents } from "~/components/courses/TableOfContents";
import {
  getCompletedPages,
  getBookmark,
  countPages,
  markPageRead,
} from "~/lib/progress";

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
      .catch((err) => {
        error.value = err.message;
      })
      .finally(() => {
        loading.value = false;
      });
  });

  if (loading.value) {
    return (
      <main class="max-w-4xl mx-auto px-7 py-10">
        <div class="animate-pulse">
          <div class="h-8 bg-border-soft rounded w-64 mb-4" />
          <div class="h-4 bg-border-soft rounded w-96 mb-8" />
          <div class="h-48 bg-border-soft rounded-xl" />
        </div>
      </main>
    );
  }

  if (error.value || !course.value) {
    return (
      <main class="max-w-4xl mx-auto px-7 py-10">
        <div class="ln-panel">
          <div class="ln-panel-body">
            <p class="text-failure text-[13px]">{error.value || "Course not found"}</p>
            <Link href="/" class="text-accent text-[13px] mt-2 inline-block">Back to courses</Link>
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

  return (
    <main class="max-w-4xl mx-auto px-7 py-10">
      {/* Breadcrumb */}
      <div class="ln-breadcrumb mb-6">
        <Link href="/dashboard" class="hover:text-text transition-colors">learn</Link>
        <span class="text-border-soft">/</span>
        <b>{c.title}</b>
      </div>

      {/* Cover image */}
      {c.cover_image_url && (
        <div class="ln-panel mb-6 overflow-hidden">
          <img
            src={c.cover_image_url}
            alt={c.title}
            class="w-full h-48 object-cover"
            width={800}
            height={192}
          />
        </div>
      )}

      {/* Course header */}
      <div class="mb-6">
        <div class="flex items-start justify-between gap-4">
          <h1 class="text-[28px] font-semibold tracking-[-0.024em]">{c.title}</h1>
          {user.value && (user.value.role === "admin" || user.value.role === "editor") && (
            <Link href={`/dashboard/courses/${c.id}`} class="ln-btn ln-btn-outline text-[12px]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </Link>
          )}
        </div>
        {c.description && (
          <p class="text-muted text-[15px] mt-2 max-w-[640px]">{c.description}</p>
        )}
        <div class="flex items-center gap-3 font-mono text-[11px] text-subtle mt-3">
          {c.author_name && <span>by {c.author_name}</span>}
          {c.created_at && (
            <span>{new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          )}
          <span>{totalPages.value} pages</span>
        </div>
      </div>

      {/* Progress bar */}
      {totalPages.value > 0 && doneCount > 0 && (
        <div class="mb-6">
          <div class="flex items-center justify-between font-mono text-[11px] mb-1.5">
            <span class="text-subtle">{doneCount} of {totalPages.value} pages read</span>
            <span class="text-accent">{pct}%</span>
          </div>
          <div class="ln-track">
            <div style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div class="flex items-center gap-2 mb-8">
        {bookmark.value && (
          <Link href={bookmark.value.href} class="ln-btn ln-btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>
            Continue Reading
          </Link>
        )}
        {firstPage && !bookmark.value && (
          <Link href={firstPage} class="ln-btn ln-btn-primary">
            Start Reading
          </Link>
        )}
        {firstPage && bookmark.value && (
          <Link href={firstPage} class="ln-btn ln-btn-outline">
            Start Over
          </Link>
        )}
      </div>

      {/* Table of Contents */}
      {c.sections && c.sections.length > 0 && (
        <div class="ln-panel">
          <div class="ln-panel-head">
            <h3>Table of Contents</h3>
          </div>
          <div class="ln-panel-body">
            <TableOfContents
              courseSlug={c.slug}
              sections={c.sections}
              completedPageIds={completedIds.value}
            />
          </div>
        </div>
      )}
    </main>
  );
});
