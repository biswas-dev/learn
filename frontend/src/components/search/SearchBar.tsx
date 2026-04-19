import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import { get } from "~/lib/api";
import type { CourseSummary } from "~/lib/types";
import { TagBadge } from "~/components/courses/TagBadge";

export const SearchBar = component$(() => {
  const isOpen = useSignal(false);
  const query = useSignal("");
  const results = useSignal<CourseSummary[]>([]);
  const selectedIndex = useSignal(-1);
  const loading = useSignal(false);
  const nav = useNavigate();

  useVisibleTask$(({ cleanup }) => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        isOpen.value = !isOpen.value;
        if (isOpen.value) {
          query.value = "";
          results.value = [];
          selectedIndex.value = -1;
          setTimeout(() => {
            document.getElementById("search-input")?.focus();
          }, 50);
        }
      }
      if (e.key === "Escape") {
        isOpen.value = false;
      }
    };
    window.addEventListener("keydown", handler);
    cleanup(() => window.removeEventListener("keydown", handler));
  });

  const doSearch = $(async (q: string) => {
    if (q.length < 2) {
      results.value = [];
      return;
    }
    loading.value = true;
    try {
      const data = await get<CourseSummary[]>(`/courses/search?q=${encodeURIComponent(q)}&limit=8`);
      results.value = data;
    } catch {
      results.value = [];
    } finally {
      loading.value = false;
    }
  });

  const onInput = $((e: InputEvent) => {
    const val = (e.target as HTMLInputElement).value;
    query.value = val;
    selectedIndex.value = -1;
    clearTimeout((window as any).__searchTimer);
    (window as any).__searchTimer = setTimeout(() => doSearch(val), 250);
  });

  const onKeyDown = $((e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex.value = Math.min(selectedIndex.value + 1, results.value.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1);
    } else if (e.key === "Enter" && selectedIndex.value >= 0) {
      e.preventDefault();
      const course = results.value[selectedIndex.value];
      if (course) {
        isOpen.value = false;
        nav(`/courses/${course.slug}`);
      }
    }
  });

  const selectCourse = $((slug: string) => {
    isOpen.value = false;
    nav(`/courses/${slug}`);
  });

  return (
    <>
      {/* Trigger button */}
      <button
        onClick$={() => {
          isOpen.value = true;
          setTimeout(() => document.getElementById("search-input")?.focus(), 50);
        }}
        class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border-soft bg-surface hover:bg-surface-hover text-subtle text-[12px] font-mono transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span class="hidden sm:inline">Search</span>
        <span class="ln-kbd hidden sm:inline">⌘K</span>
      </button>

      {/* Modal overlay */}
      {isOpen.value && (
        <div
          class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
          style={{ background: "oklch(0 0 0 / 0.6)", backdropFilter: "blur(4px)" }}
          onClick$={(e) => {
            if (e.target === e.currentTarget) isOpen.value = false;
          }}
        >
          <div class="w-full max-w-lg ln-panel" style={{ boxShadow: "0 20px 60px -20px oklch(0 0 0 / 0.7)" }}>
            {/* Search input */}
            <div class="flex items-center gap-3 px-4 py-3 border-b border-border-soft">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-subtle)" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                id="search-input"
                type="text"
                value={query.value}
                onInput$={onInput}
                onKeyDown$={onKeyDown}
                placeholder="Search courses..."
                class="flex-1 bg-transparent text-text placeholder-subtle outline-none text-[13.5px]"
                autoComplete="off"
              />
              {loading.value && (
                <div class="w-3.5 h-3.5 border-[1.5px] border-accent border-t-transparent rounded-full animate-spin" />
              )}
              <span class="ln-kbd">ESC</span>
            </div>

            {/* Results */}
            <div class="max-h-80 overflow-y-auto">
              {results.value.length === 0 && query.value.length >= 2 && !loading.value && (
                <div class="px-4 py-8 text-center text-subtle text-[13px]">No courses found</div>
              )}
              {results.value.map((course, i) => (
                <button
                  key={course.id}
                  onClick$={() => selectCourse(course.slug)}
                  class={`w-full px-[18px] py-3 flex flex-col gap-1 text-left transition-colors border-b border-dashed border-border-soft last:border-0 ${
                    i === selectedIndex.value
                      ? "bg-[color-mix(in_oklch,var(--color-accent)_10%,transparent)]"
                      : "hover:bg-[color-mix(in_oklch,var(--color-surface)_60%,var(--color-bg-2))]"
                  }`}
                >
                  <span class="text-[13px] font-medium text-text">{course.title}</span>
                  <span class="text-[11px] text-subtle font-mono line-clamp-1">{course.description}</span>
                  {course.tags && course.tags.length > 0 && (
                    <div class="flex gap-1 mt-0.5">
                      {course.tags.slice(0, 3).map((tag) => (
                        <TagBadge key={tag.id} name={tag.name} category={tag.category} />
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Footer hint */}
            <div class="px-4 py-2 border-t border-border-soft flex gap-4 font-mono text-[10.5px] text-subtle">
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span>esc close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
