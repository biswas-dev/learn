import { component$, useSignal, useTask$, useVisibleTask$, $ } from "@builder.io/qwik";
import { api } from "~/lib/api";

interface Props {
  content: string;
  title?: string;
  onSave$: (content: string) => void;
}

type ViewMode = "edit" | "preview" | "full";

const TOOLBAR: { label: string; before: string; after: string; block?: boolean }[] = [
  { label: "B", before: "**", after: "**" },
  { label: "I", before: "*", after: "*" },
  { label: "H2", before: "## ", after: "", block: true },
  { label: "H3", before: "### ", after: "", block: true },
  { label: "\u2022 List", before: "- ", after: "", block: true },
  { label: "1. List", before: "1. ", after: "", block: true },
  { label: "\u201C Quote", before: "> ", after: "", block: true },
  { label: "HR", before: "\n---\n", after: "" },
  { label: "Code", before: "`", after: "`" },
  { label: "Link", before: "[", after: "](url)" },
];

export const WikiEditor = component$<Props>(({ content, title, onSave$ }) => {
  const markdown = useSignal(content);
  const preview = useSignal("");
  const mode = useSignal<ViewMode>("full");
  const fullscreen = useSignal(false);
  const saving = useSignal(false);
  const dirty = useSignal(false);
  const previewLoading = useSignal(false);
  const previewTimer = useSignal<number | null>(null);

  useTask$(({ track }) => {
    track(() => content);
    markdown.value = content;
  });

  const fetchPreview = $(async () => {
    const md = markdown.value;
    if (!md) return;
    previewLoading.value = true;
    try {
      // If content is already HTML (imported pages), show it directly
      if (md.trimStart().startsWith("<")) {
        preview.value = md;
      } else {
        const result = await api<{ html: string }>("/wiki/preview", {
          method: "POST",
          body: JSON.stringify({ content: md }),
        });
        preview.value = result.html;
      }
    } catch {
      preview.value = "<p class='text-failure'>Failed to render preview.</p>";
    } finally {
      previewLoading.value = false;
    }
  });

  const debouncedPreview = $(() => {
    if (previewTimer.value) clearTimeout(previewTimer.value);
    previewTimer.value = window.setTimeout(() => {
      fetchPreview();
    }, 400) as unknown as number;
  });

  const handleSave = $(async () => {
    saving.value = true;
    try {
      await onSave$(markdown.value);
      dirty.value = false;
    } finally {
      saving.value = false;
    }
  });

  const handleInput = $((value: string) => {
    markdown.value = value;
    dirty.value = true;
    if (mode.value === "full" || mode.value === "preview") {
      debouncedPreview();
    }
  });

  const insertMarkdown = $((before: string, after: string, block: boolean | undefined) => {
    const el = document.querySelector("[data-wiki-textarea]") as HTMLTextAreaElement;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const selected = text.substring(start, end);

    let insert: string;
    if (block && start > 0 && text[start - 1] !== "\n") {
      insert = "\n" + before + selected + after;
    } else {
      insert = before + selected + after;
    }

    el.setRangeText(insert, start, end, "end");
    markdown.value = el.value;
    dirty.value = true;
    el.focus();

    if (mode.value === "full" || mode.value === "preview") {
      debouncedPreview();
    }
  });

  // Keyboard shortcuts
  useVisibleTask$(() => {
    const handler = (e: KeyboardEvent) => {
      // F11 or Cmd+Shift+F for fullscreen
      if (e.key === "F11" || (e.metaKey && e.shiftKey && e.key === "f")) {
        e.preventDefault();
        fullscreen.value = !fullscreen.value;
      }
      // Escape to exit fullscreen
      if (e.key === "Escape" && fullscreen.value) {
        fullscreen.value = false;
      }
      // Cmd+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  // Trigger preview when content prop changes (e.g. async load)
  useVisibleTask$(({ track }) => {
    const md = track(() => markdown.value);
    if (md && (mode.value === "full" || mode.value === "preview")) {
      fetchPreview();
    }
  });

  const showEditor = mode.value === "edit" || mode.value === "full";
  const showPreview = mode.value === "preview" || mode.value === "full";

  const containerClass = fullscreen.value
    ? "fixed inset-0 z-[90] bg-surface flex flex-col"
    : "flex flex-col h-full";

  return (
    <div class={containerClass}>
      {/* Top bar */}
      <div class="flex items-center gap-1 border-b border-border px-3 py-2 bg-elevated shrink-0 flex-wrap">
        {/* Toolbar buttons */}
        {showEditor &&
          TOOLBAR.map((item) => (
            <button
              key={item.label}
              class="px-2 py-1 text-xs font-medium text-muted hover:text-text hover:bg-surface-hover rounded transition-colors"
              onClick$={() => insertMarkdown(item.before, item.after, item.block)}
              title={item.label}
            >
              {item.label}
            </button>
          ))}

        {showEditor && <div class="w-px h-5 bg-border mx-1" />}

        {/* Mode tabs */}
        <button
          class={[
            "px-2.5 py-1 text-xs font-medium rounded transition-colors",
            mode.value === "edit"
              ? "bg-accent text-white"
              : "text-muted hover:text-text hover:bg-surface-hover",
          ]}
          onClick$={() => {
            mode.value = "edit";
          }}
        >
          Edit
        </button>
        <button
          class={[
            "px-2.5 py-1 text-xs font-medium rounded transition-colors",
            mode.value === "preview"
              ? "bg-accent text-white"
              : "text-muted hover:text-text hover:bg-surface-hover",
          ]}
          onClick$={async () => {
            mode.value = "preview";
            await fetchPreview();
          }}
        >
          Preview
        </button>
        <label class="flex items-center gap-1.5 px-2 py-1 text-xs text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={mode.value === "full"}
            class="accent-accent"
            onChange$={(_, el) => {
              mode.value = el.checked ? "full" : "edit";
              if (el.checked) fetchPreview();
            }}
          />
          Full
        </label>

        <div class="flex-1" />

        {/* Status + actions */}
        {dirty.value && (
          <span class="text-xs text-warning mr-2">Unsaved</span>
        )}
        {saving.value && (
          <span class="text-xs text-accent mr-2">Saving...</span>
        )}

        <button
          class="px-3 py-1 text-xs font-medium bg-accent text-white rounded hover:bg-accent-hover transition-colors disabled:opacity-50"
          disabled={saving.value || !dirty.value}
          onClick$={handleSave}
        >
          Save
        </button>

        <div class="w-px h-5 bg-border mx-1" />

        <button
          class="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-muted hover:text-text hover:bg-surface-hover rounded transition-colors"
          onClick$={() => {
            fullscreen.value = !fullscreen.value;
          }}
        >
          {fullscreen.value ? (
            <>
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
              Exit
            </>
          ) : (
            <>
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
              Fullscreen
            </>
          )}
        </button>
      </div>

      {/* Title bar in fullscreen */}
      {fullscreen.value && title && (
        <div class="px-4 py-2 border-b border-border bg-elevated/50 shrink-0">
          <span class="text-sm font-medium text-text">{title}</span>
        </div>
      )}

      {/* Editor + Preview panes */}
      <div class="flex flex-1 min-h-0 overflow-hidden">
        {/* Editor pane */}
        {showEditor && (
          <div class={[
            "flex flex-col min-h-0 overflow-hidden",
            mode.value === "full" ? "w-1/2 border-r border-border" : "w-full",
          ]}>
            {mode.value === "full" && (
              <div class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted border-b border-border bg-elevated/30">
                Markdown
              </div>
            )}
            <textarea
              data-wiki-textarea
              class="flex-1 w-full bg-surface p-4 text-text text-sm font-mono resize-none focus:outline-none leading-relaxed overflow-y-auto"
              style={fullscreen.value ? undefined : { minHeight: "500px" }}
              value={markdown.value}
              onInput$={(_, el) => handleInput(el.value)}
              onKeyDown$={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const el = e.target as HTMLTextAreaElement;
                  const start = el.selectionStart;
                  el.setRangeText("  ", start, start, "end");
                  markdown.value = el.value;
                  dirty.value = true;
                }
              }}
              placeholder="Start writing markdown..."
            />
          </div>
        )}

        {/* Preview pane */}
        {showPreview && (
          <div class={[
            "flex flex-col min-h-0 overflow-hidden",
            mode.value === "full" ? "w-1/2" : "w-full",
          ]}>
            {mode.value === "full" && (
              <div class="flex items-center justify-between px-3 py-1.5 border-b border-border bg-elevated/30">
                <span class="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Preview
                </span>
                {previewLoading.value && (
                  <span class="text-[10px] text-accent">Rendering...</span>
                )}
              </div>
            )}
            <div
              class="flex-1 ln-prose p-6 overflow-y-auto bg-surface"
              dangerouslySetInnerHTML={preview.value || "<p class='text-muted'>Preview will appear here...</p>"}
            />
          </div>
        )}
      </div>
    </div>
  );
});
