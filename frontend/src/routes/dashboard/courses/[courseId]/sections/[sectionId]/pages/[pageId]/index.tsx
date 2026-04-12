import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { useLocation, Link } from "@builder.io/qwik-city";
import { get, put } from "~/lib/api";
import type { Page, PageVersion } from "~/lib/types";
import { WikiEditor } from "~/components/editor/WikiEditor";

export default component$(() => {
  const loc = useLocation();
  const { courseId, sectionId, pageId } = loc.params;

  const page = useSignal<Page | null>(null);
  const versions = useSignal<PageVersion[]>([]);
  const loading = useSignal(true);
  const error = useSignal("");
  const showVersions = useSignal(false);

  useVisibleTask$(() => {
    // We need to fetch page content. The API doesn't have a direct GET /pages/:id,
    // but we can use the content update endpoint pattern. Let's fetch versions to get content.
    // Actually, we'll load all courses to find the page, or fetch versions.
    // Simplest: fetch versions for this page and use the latest content.
    Promise.all([
      get<PageVersion[]>(`/pages/${pageId}/versions`),
    ])
      .then(([vers]) => {
        versions.value = vers;
        if (vers.length > 0) {
          const latest = vers[vers.length - 1];
          page.value = {
            id: Number(pageId),
            section_id: Number(sectionId),
            title: "",
            slug: "",
            content: latest.content,
            sort_order: 0,
            created_by: 0,
            created_at: "",
            updated_at: "",
          };
        } else {
          page.value = {
            id: Number(pageId),
            section_id: Number(sectionId),
            title: "",
            slug: "",
            content: "",
            sort_order: 0,
            created_by: 0,
            created_at: "",
            updated_at: "",
          };
        }
      })
      .catch((err) => {
        error.value = err.message;
      })
      .finally(() => {
        loading.value = false;
      });
  });

  const handleSave = $(async (content: string) => {
    try {
      await put(`/pages/${pageId}/content`, { content });
      // Refresh versions
      const vers = await get<PageVersion[]>(`/pages/${pageId}/versions`);
      versions.value = vers;
    } catch (err: any) {
      error.value = err.message;
    }
  });

  const restoreVersion = $(async (versionNum: number) => {
    try {
      await fetch(`/api/pages/${pageId}/versions/${versionNum}/restore`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("learn_token")}`,
        },
      });
      // Reload
      const vers = await get<PageVersion[]>(`/pages/${pageId}/versions`);
      versions.value = vers;
      if (vers.length > 0) {
        const latest = vers[vers.length - 1];
        page.value = {
          ...page.value!,
          content: latest.content,
        };
      }
    } catch (err: any) {
      error.value = err.message;
    }
  });

  if (loading.value) {
    return <div class="p-8"><p class="text-muted">Loading editor...</p></div>;
  }

  if (error.value && !page.value) {
    return <div class="p-8"><p class="text-failure">{error.value}</p></div>;
  }

  return (
    <div class="p-8">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <Link
            href={`/dashboard/courses/${courseId}`}
            class="text-sm text-muted hover:text-accent transition-colors"
          >
            &larr; Back to course
          </Link>
          <h1 class="text-xl font-bold text-text">Edit Page</h1>
        </div>
        <button
          class="text-sm text-muted hover:text-text transition-colors"
          onClick$={() => {
            showVersions.value = !showVersions.value;
          }}
        >
          {showVersions.value ? "Hide" : "Show"} Versions ({versions.value.length})
        </button>
      </div>

      {error.value && (
        <div class="mb-4 p-3 bg-failure/10 border border-failure/20 rounded-md text-sm text-failure">
          {error.value}
        </div>
      )}

      <div class="flex gap-6">
        <div class="flex-1 min-w-0">
          <WikiEditor
            content={page.value?.content ?? ""}
            onSave$={handleSave}
          />
        </div>

        {showVersions.value && (
          <aside class="w-64 shrink-0">
            <h3 class="text-sm font-semibold text-text mb-3">Version History</h3>
            <div class="space-y-2 max-h-[600px] overflow-y-auto">
              {versions.value
                .slice()
                .reverse()
                .map((v) => (
                  <div
                    key={v.id}
                    class="p-3 border border-border rounded-md bg-elevated"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-text font-medium">
                        v{v.version_number}
                      </span>
                      <button
                        class="text-xs text-accent hover:text-accent-hover"
                        onClick$={() => restoreVersion(v.version_number)}
                      >
                        Restore
                      </button>
                    </div>
                    <p class="text-xs text-muted mt-1">
                      {new Date(v.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
});
