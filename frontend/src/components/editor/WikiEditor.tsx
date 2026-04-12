import { component$, useSignal, useTask$, $ } from "@builder.io/qwik";
import { api } from "~/lib/api";

interface Props {
  content: string;
  onSave$: (content: string) => void;
}

export const WikiEditor = component$<Props>(({ content, onSave$ }) => {
  const markdown = useSignal(content);
  const preview = useSignal("");
  const activeTab = useSignal<"edit" | "preview">("edit");
  const saving = useSignal(false);

  useTask$(({ track }) => {
    track(() => content);
    markdown.value = content;
  });

  const fetchPreview = $(async () => {
    try {
      const result = await api<{ html: string }>("/wiki/preview", {
        method: "POST",
        body: JSON.stringify({ content: markdown.value }),
      });
      preview.value = result.html;
    } catch {
      preview.value = "<p>Failed to render preview.</p>";
    }
  });

  const handleSave = $(async () => {
    saving.value = true;
    try {
      await onSave$(markdown.value);
    } finally {
      saving.value = false;
    }
  });

  return (
    <div class="flex flex-col h-full">
      {/* Tabs */}
      <div class="flex items-center gap-2 border-b border-border pb-2 mb-4">
        <button
          class={[
            "px-3 py-1.5 text-sm rounded-md transition-colors",
            activeTab.value === "edit"
              ? "bg-accent/10 text-accent"
              : "text-muted hover:text-text",
          ]}
          onClick$={() => {
            activeTab.value = "edit";
          }}
        >
          Edit
        </button>
        <button
          class={[
            "px-3 py-1.5 text-sm rounded-md transition-colors",
            activeTab.value === "preview"
              ? "bg-accent/10 text-accent"
              : "text-muted hover:text-text",
          ]}
          onClick$={async () => {
            activeTab.value = "preview";
            await fetchPreview();
          }}
        >
          Preview
        </button>
        <div class="flex-1" />
        <button
          class="px-4 py-1.5 text-sm bg-accent text-white rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50"
          disabled={saving.value}
          onClick$={handleSave}
        >
          {saving.value ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Content */}
      {activeTab.value === "edit" ? (
        <textarea
          class="flex-1 w-full bg-surface border border-border rounded-md p-4 text-text text-sm font-mono resize-none focus:outline-none focus:border-accent min-h-[400px]"
          value={markdown.value}
          onInput$={(_, el) => {
            markdown.value = el.value;
          }}
        />
      ) : (
        <div
          class="flex-1 ln-prose p-4 border border-border rounded-md bg-surface overflow-y-auto min-h-[400px]"
          dangerouslySetInnerHTML={preview.value}
        />
      )}
    </div>
  );
});
