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

  useVisibleTask$(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F11" || (e.metaKey && e.shiftKey && e.key === "f")) {
        e.preventDefault();
        fullscreen.value = !fullscreen.value;
      }
      if (e.key === "Escape" && fullscreen.value) {
        fullscreen.value = false;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  useVisibleTask$(({ track }) => {
    const md = track(() => markdown.value);
    if (md && (mode.value === "full" || mode.value === "preview")) {
      fetchPreview();
    }
  });

  const showEditor = mode.value === "edit" || mode.value === "full";
  const showPreview = mode.value === "preview" || mode.value === "full";

  const containerClass = fullscreen.value
    ? "fixed inset-0 z-[90] bg-bg flex flex-col"
    : "flex flex-col h-full";

  return (
    <div class={containerClass}>
      {/* Top bar */}
      <div class="flex items-center gap-1 border-b border-border-soft px-3 py-2 bg-bg-2 shrink-0 flex-wrap">
        {showEditor &&
          TOOLBAR.map((item) => (
            <button
              key={item.label}
              class="px-2 py-1 text-[11px] font-mono text-muted hover:text-text hover:bg-surface rounded-[5px] transition-colors"
              onClick$={() => insertMarkdown(item.before, item.after, item.block)}
              title={item.label}
            >
              {item.label}
            </button>
          ))}

        {showEditor && <div class="w-px h-5 bg-border-soft mx-1" />}

        {/* Mode tabs */}
        <button
          class={`px-2.5 py-1 text-[11px] font-mono rounded-[5px] transition-colors ${
            mode.value === "edit" ? "bg-surface text-text border border-border-soft" : "text-subtle hover:text-text"
          }`}
          onClick$={() => { mode.value = "edit"; }}
        >
          Edit
        </button>
        <button
          class={`px-2.5 py-1 text-[11px] font-mono rounded-[5px] transition-colors ${
            mode.value === "preview" ? "bg-surface text-text border border-border-soft" : "text-subtle hover:text-text"
          }`}
          onClick$={async () => { mode.value = "preview"; await fetchPreview(); }}
        >
          Preview
        </button>
        <label class="flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono text-subtle cursor-pointer">
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

        {dirty.value && (
          <span class="ln-pill warn mr-2">Unsaved</span>
        )}
        {saving.value && (
          <span class="ln-pill run mr-2">Saving...</span>
        )}

        <button
          class="ln-btn ln-btn-primary text-[12px] py-1"
          disabled={saving.value || !dirty.value}
          onClick$={handleSave}
        >
          Save
        </button>

        <div class="w-px h-5 bg-border-soft mx-1" />

        <button
          class="ln-btn ln-btn-ghost text-[11px]"
          onClick$={() => { fullscreen.value = !fullscreen.value; }}
        >
          {fullscreen.value ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
              Exit
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
              Fullscreen
            </>
          )}
        </button>
      </div>

      {/* Title bar in fullscreen */}
      {fullscreen.value && title && (
        <div class="px-4 py-2 border-b border-border-soft bg-bg-2 shrink-0">
          <span class="text-[13px] font-medium">{title}</span>
        </div>
      )}

      {/* Editor + Preview panes */}
      <div class="flex flex-1 min-h-0 overflow-hidden">
        {showEditor && (
          <div class={[
            "flex flex-col min-h-0 overflow-hidden",
            mode.value === "full" ? "w-1/2 border-r border-border-soft" : "w-full",
          ]}>
            {mode.value === "full" && (
              <div class="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-subtle border-b border-border-soft bg-bg-2">
                Markdown
              </div>
            )}
            <textarea
              data-wiki-textarea
              class="flex-1 w-full bg-surface p-4 text-text text-[13.5px] font-mono resize-none focus:outline-none leading-relaxed overflow-y-auto"
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

        {showPreview && (
          <div class={[
            "flex flex-col min-h-0 overflow-hidden",
            mode.value === "full" ? "w-1/2" : "w-full",
          ]}>
            {mode.value === "full" && (
              <div class="flex items-center justify-between px-3 py-1.5 border-b border-border-soft bg-bg-2">
                <span class="font-mono text-[10px] uppercase tracking-[0.1em] text-subtle">
                  Preview
                </span>
                {previewLoading.value && (
                  <span class="ln-pill run text-[9px]">Rendering</span>
                )}
              </div>
            )}
            <div
              class="flex-1 ln-prose p-6 overflow-y-auto bg-surface"
              dangerouslySetInnerHTML={preview.value || "<p class='text-subtle'>Preview will appear here...</p>"}
            />
          </div>
        )}
      </div>
    </div>
  );
});
