import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import { get } from "~/lib/api";
import type { CourseSummary } from "~/lib/types";

export const SearchBar = component$(() => {
  const isOpen = useSignal(false);
  const query = useSignal("");
  const results = useSignal<CourseSummary[]>([]);
  const selectedIndex = useSignal(-1);
  const loading = useSignal(false);
  const nav = useNavigate();

  // Global Cmd+K listener
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
    // Debounce
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
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-elevated text-muted text-sm transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span class="hidden sm:inline">Search</span>
        <kbd class="hidden sm:inline text-xs bg-elevated px-1.5 py-0.5 rounded border border-border">⌘K</kbd>
      </button>

      {/* Modal overlay */}
      {isOpen.value && (
        <div
          class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
          onClick$={(e) => {
            if (e.target === e.currentTarget) isOpen.value = false;
          }}
        >
          <div class="w-full max-w-lg bg-elevated rounded-xl border border-border shadow-2xl overflow-hidden">
            {/* Search input */}
            <div class="flex items-center gap-3 px-4 py-3 border-b border-border">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c8ca8" stroke-width="2">
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
                class="flex-1 bg-transparent text-text placeholder-muted outline-none text-sm"
                autoComplete="off"
              />
              {loading.value && (
                <div class="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              )}
              <kbd class="text-xs text-muted bg-surface px-1.5 py-0.5 rounded border border-border">ESC</kbd>
            </div>

            {/* Results */}
            <div class="max-h-80 overflow-y-auto">
              {results.value.length === 0 && query.value.length >= 2 && !loading.value && (
                <div class="px-4 py-8 text-center text-muted text-sm">No courses found</div>
              )}
              {results.value.map((course, i) => (
                <button
                  key={course.id}
                  onClick$={() => selectCourse(course.slug)}
                  class={`w-full px-4 py-3 flex flex-col gap-1 text-left transition-colors ${
                    i === selectedIndex.value ? "bg-accent/10" : "hover:bg-surface"
                  }`}
                >
                  <span class="text-sm font-medium text-text">{course.title}</span>
                  <span class="text-xs text-muted line-clamp-1">{course.description}</span>
                  {course.tags && course.tags.length > 0 && (
                    <div class="flex gap-1 mt-0.5">
                      {course.tags.slice(0, 3).map((tag) => (
                        <span key={tag.id} class="text-xs px-1.5 py-0.5 rounded bg-border text-muted">
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Footer hint */}
            <div class="px-4 py-2 border-t border-border flex gap-4 text-xs text-muted">
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
