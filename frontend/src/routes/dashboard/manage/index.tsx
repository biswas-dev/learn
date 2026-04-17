import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { get } from "~/lib/api";
import type { Course } from "~/lib/types";

export default component$(() => {
  const courses = useSignal<Course[]>([]);
  const filtered = useSignal<Course[]>([]);
  const loading = useSignal(true);
  const search = useSignal("");

  useVisibleTask$(() => {
    get<Course[]>("/courses")
      .then((data) => {
        courses.value = data;
        filtered.value = data;
      })
      .catch(() => {})
      .finally(() => {
        loading.value = false;
      });
  });

  const onSearch = $((q: string) => {
    search.value = q;
    if (!q) {
      filtered.value = courses.value;
      return;
    }
    const lower = q.toLowerCase();
    filtered.value = courses.value.filter(
      (c) => c.title.toLowerCase().includes(lower) || c.slug.includes(lower)
    );
  });

  return (
    <div class="p-6 sm:p-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold text-text">Manage Courses</h1>
        <span class="text-sm text-muted">{courses.value.length} courses</span>
      </div>

      {/* Search filter */}
      <div class="mb-4">
        <input
          type="text"
          value={search.value}
          onInput$={(_, el) => { onSearch(el.value); }}
          placeholder="Filter courses..."
          class="w-full max-w-md px-4 py-2 rounded-lg bg-surface border border-border text-text placeholder-muted text-sm focus:outline-none focus:border-accent"
        />
      </div>

      {loading.value && <p class="text-muted">Loading...</p>}

      <div class="space-y-2">
        {filtered.value.map((course) => (
          <div
            key={course.id}
            class="flex items-center justify-between p-3 bg-elevated border border-border rounded-lg hover:border-accent/30 transition-colors"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <Link
                  href={`/courses/${course.slug}/`}
                  class="text-sm font-medium text-text hover:text-accent transition-colors truncate"
                >
                  {course.title}
                </Link>
                {course.is_published ? (
                  <span class="shrink-0 text-xs px-1.5 py-0.5 bg-success/10 text-success rounded">Published</span>
                ) : (
                  <span class="shrink-0 text-xs px-1.5 py-0.5 bg-warning/10 text-warning rounded">Draft</span>
                )}
                {course.is_protected && (
                  <span class="shrink-0 text-xs px-1.5 py-0.5 bg-accent/10 text-accent rounded">Protected</span>
                )}
              </div>
              <p class="text-xs text-muted mt-0.5">
                {course.slug} &middot; {course.section_count ?? 0} sections &middot; {course.page_count ?? 0} pages
              </p>
            </div>
            <Link
              href={`/dashboard/courses/${course.id}`}
              class="shrink-0 ml-4 flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-accent bg-surface border border-border rounded-lg hover:border-accent/30 transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </Link>
          </div>
        ))}
      </div>

      {!loading.value && filtered.value.length === 0 && (
        <p class="text-muted text-center py-8">No courses match your filter.</p>
      )}
    </div>
  );
});
