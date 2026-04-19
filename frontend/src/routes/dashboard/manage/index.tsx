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
    <div class="p-6 lg:px-8 lg:pb-16 max-w-[1500px]">
      {/* Page top */}
      <div class="flex items-center justify-between mb-[18px] gap-4">
        <div class="ln-breadcrumb">
          learn <span class="text-border-soft">/</span> <b>manage courses</b>
        </div>
        <div class="flex gap-2 items-center">
          <div class="flex items-center gap-2 bg-surface border border-border-soft px-2.5 py-1.5 rounded-lg text-subtle font-mono text-[12px] w-[240px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              value={search.value}
              onInput$={(_, el) => { onSearch(el.value); }}
              placeholder="Filter courses..."
              class="bg-transparent border-0 outline-none text-text font-mono text-[12px] flex-1"
              autoComplete="off"
            />
          </div>
          <Link href="/dashboard/courses/new" class="ln-btn ln-btn-primary text-[13px]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14m-7-7h14"/></svg>
            New
          </Link>
        </div>
      </div>

      {/* Greet */}
      <div class="ln-greet">
        <h1>Manage Courses <em>{courses.value.length}</em></h1>
      </div>

      {loading.value && (
        <div class="animate-pulse space-y-2">
          {[1,2,3].map((i) => <div key={i} class="h-14 bg-border-soft rounded-xl" />)}
        </div>
      )}

      {!loading.value && (
        <div class="ln-panel">
          <div class="ln-panel-body p0">
            <table class="ln-tbl">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Status</th>
                  <th>Content</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.value.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <Link href={`/courses/${course.slug}/`} class="hover:text-accent transition-colors">
                        <b>{course.title}</b>
                        <span class="block text-subtle font-mono text-[10.5px] mt-0.5">{course.slug}</span>
                      </Link>
                    </td>
                    <td>
                      <div class="flex gap-1.5">
                        {course.is_published ? (
                          <span class="ln-pill ok">Published</span>
                        ) : (
                          <span class="ln-pill warn">Draft</span>
                        )}
                        {course.is_protected && (
                          <span class="ln-pill run">Protected</span>
                        )}
                      </div>
                    </td>
                    <td class="mono">
                      {course.section_count ?? 0} sections &middot; {course.page_count ?? 0} pages
                    </td>
                    <td>
                      <Link
                        href={`/dashboard/courses/${course.id}`}
                        class="ln-btn ln-btn-ghost text-[12px]"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading.value && filtered.value.length === 0 && (
        <div class="text-center py-16 text-subtle">No courses match your filter.</div>
      )}
    </div>
  );
});
