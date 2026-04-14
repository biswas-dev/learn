import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { useLocation, Link, type StaticGenerateHandler } from "@builder.io/qwik-city";

export const onStaticGenerate: StaticGenerateHandler = async () => {
  return { params: [{ courseId: "_", sectionId: "_", pageId: "_" }] };
};
import { get, put } from "~/lib/api";
import type { Course, Page, PageVersion } from "~/lib/types";
import { WikiEditor } from "~/components/editor/WikiEditor";

export default component$(() => {
  const loc = useLocation();
  const courseId = useSignal(loc.params.courseId);
  const sectionId = useSignal(loc.params.sectionId);
  const pageId = useSignal(loc.params.pageId);

  const page = useSignal<Page | null>(null);
  const versions = useSignal<PageVersion[]>([]);
  const loading = useSignal(true);
  const error = useSignal("");
  const showVersions = useSignal(false);

  useVisibleTask$(() => {
    // Resolve real IDs from URL (SSG params are "_")
    const parts = window.location.pathname.split("/").filter(Boolean);
    const ci = parts.indexOf("courses");
    const si = parts.indexOf("sections");
    const pi = parts.indexOf("pages");
    if (ci >= 0 && parts[ci + 1] !== "_") courseId.value = parts[ci + 1];
    if (si >= 0 && parts[si + 1] !== "_") sectionId.value = parts[si + 1];
    if (pi >= 0 && parts[pi + 1] !== "_") pageId.value = parts[pi + 1];

    const pid = Number(pageId.value);
    const sid = Number(sectionId.value);

    Promise.all([
      get<PageVersion[]>(`/pages/${pageId.value}/versions`),
      get<Course[]>("/courses").then(async (courses) => {
        const c = courses.find((x) => String(x.id) === courseId.value);
        if (!c) return null;
        return get<Course>(`/courses/${c.slug}`);
      }).catch(() => null),
    ])
      .then(async ([vers, course]) => {
        versions.value = vers;

        // Find page title and slugs from course data
        let pageTitle = "";
        let sectionSlug = "";
        let pageSlug = "";
        if (course?.sections) {
          for (const s of course.sections) {
            const found = s.pages?.find((p) => p.id === pid);
            if (found) {
              pageTitle = found.title;
              sectionSlug = s.slug;
              pageSlug = found.slug;
              break;
            }
          }
        }

        // Get content: prefer versions, fall back to fetching page directly
        let content = vers.length > 0 ? vers[vers.length - 1].content : "";
        if (!content && course && sectionSlug && pageSlug) {
          try {
            const pageData = await get<Page>(
              `/courses/${course.slug}/sections/${sectionSlug}/pages/${pageSlug}`,
            );
            content = pageData.content || "";
          } catch {}
        }

        page.value = {
          id: pid,
          section_id: sid,
          title: pageTitle,
          slug: pageSlug,
          content,
          sort_order: 0,
          created_by: 0,
          created_at: "",
          updated_at: "",
        };
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
      await put(`/pages/${pageId.value}/content`, { content });
      // Refresh versions
      const vers = await get<PageVersion[]>(`/pages/${pageId.value}/versions`);
      versions.value = vers;
    } catch (err: any) {
      error.value = err.message;
    }
  });

  const restoreVersion = $(async (versionNum: number) => {
    try {
      await fetch(`/api/pages/${pageId.value}/versions/${versionNum}/restore`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("learn_token")}`,
        },
      });
      // Reload
      const vers = await get<PageVersion[]>(`/pages/${pageId.value}/versions`);
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
    <div class="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header bar */}
      <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-elevated/50 shrink-0">
        <div class="flex items-center gap-3">
          <Link
            href={`/dashboard/courses/${courseId.value}`}
            class="text-sm text-muted hover:text-accent transition-colors"
          >
            &larr; Back
          </Link>
          <h1 class="text-sm font-bold text-text">{page.value?.title || "Edit Page"}</h1>
        </div>
        <button
          class="text-xs text-muted hover:text-text transition-colors"
          onClick$={() => {
            showVersions.value = !showVersions.value;
          }}
        >
          {showVersions.value ? "Hide" : "Show"} Versions ({versions.value.length})
        </button>
      </div>

      {error.value && (
        <div class="px-4 py-2 bg-failure/10 border-b border-failure/20 text-sm text-failure shrink-0">
          {error.value}
        </div>
      )}

      <div class="flex flex-1 min-h-0">
        <div class="flex-1 min-w-0">
          <WikiEditor
            content={page.value?.content ?? ""}
            title={page.value?.title}
            onSave$={handleSave}
          />
        </div>

        {showVersions.value && (
          <aside class="w-56 shrink-0 border-l border-border p-3 overflow-y-auto bg-elevated/30">
            <h3 class="text-xs font-semibold text-text mb-3">Versions</h3>
            <div class="space-y-2">
              {versions.value
                .slice()
                .reverse()
                .map((v) => (
                  <div
                    key={v.id}
                    class="p-2 border border-border rounded-md bg-elevated"
                  >
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-text font-medium">
                        v{v.version_number}
                      </span>
                      <button
                        class="text-[10px] text-accent hover:text-accent-hover"
                        onClick$={() => restoreVersion(v.version_number)}
                      >
                        Restore
                      </button>
                    </div>
                    <p class="text-[10px] text-muted mt-1">
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
