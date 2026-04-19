import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { useLocation, Link, type StaticGenerateHandler } from "@builder.io/qwik-city";

export const onStaticGenerate: StaticGenerateHandler = async () => {
  return { params: [{ courseId: "_" }] };
};
import { get, put, post, del } from "~/lib/api";
import type { Course, Section, Page } from "~/lib/types";

export default component$(() => {
  const loc = useLocation();
  const courseId = useSignal(loc.params.courseId);

  const course = useSignal<Course | null>(null);
  const loading = useSignal(true);
  const error = useSignal("");
  const saving = useSignal(false);

  const title = useSignal("");
  const description = useSignal("");
  const isProtected = useSignal(false);

  const newSectionTitle = useSignal("");
  const addingSection = useSignal(false);

  const newPageTitle = useSignal<Record<number, string>>({});
  const addingPage = useSignal<Record<number, boolean>>({});

  const loadCourse = $(async () => {
    try {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("courses");
      if (idx >= 0 && parts[idx + 1] && parts[idx + 1] !== "_") {
        courseId.value = parts[idx + 1];
      }
      const courses = await get<Course[]>("/courses");
      const c = courses.find((x) => String(x.id) === courseId.value);
      if (!c) throw new Error("Course not found");
      const full = await get<Course>(`/courses/${c.slug}`);
      course.value = full;
      title.value = full.title;
      description.value = full.description;
      isProtected.value = full.is_protected;
    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  });

  useVisibleTask$(() => { loadCourse(); });

  const saveCourse = $(async () => {
    saving.value = true;
    try {
      await put<Course>(`/courses/${courseId.value}`, {
        title: title.value,
        description: description.value,
        is_protected: isProtected.value,
      });
      if (course.value) {
        course.value = { ...course.value, title: title.value, description: description.value, is_protected: isProtected.value };
      }
    } catch (err: any) { error.value = err.message; }
    finally { saving.value = false; }
  });

  const addSection = $(async () => {
    if (!newSectionTitle.value.trim()) return;
    addingSection.value = true;
    try {
      const slug = newSectionTitle.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await post<Section>(`/courses/${courseId}/sections`, { title: newSectionTitle.value, slug });
      newSectionTitle.value = "";
      loading.value = true;
      await loadCourse();
    } catch (err: any) { error.value = err.message; }
    finally { addingSection.value = false; }
  });

  const addPage = $(async (sectionId: number) => {
    const pageTitle = newPageTitle.value[sectionId]?.trim();
    if (!pageTitle) return;
    addingPage.value = { ...addingPage.value, [sectionId]: true };
    try {
      const slug = pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await post<Page>(`/sections/${sectionId}/pages`, { title: pageTitle, slug });
      newPageTitle.value = { ...newPageTitle.value, [sectionId]: "" };
      loading.value = true;
      await loadCourse();
    } catch (err: any) { error.value = err.message; }
    finally { addingPage.value = { ...addingPage.value, [sectionId]: false }; }
  });

  const deleteSection = $(async (sectionId: number) => {
    if (!confirm("Delete this section and all its pages?")) return;
    try { await del(`/sections/${sectionId}`); loading.value = true; await loadCourse(); }
    catch (err: any) { error.value = err.message; }
  });

  const publishCourse = $(async () => {
    try { await post(`/courses/${courseId}/publish`, {}); loading.value = true; await loadCourse(); }
    catch (err: any) { error.value = err.message; }
  });

  if (loading.value) {
    return (
      <div class="p-6 lg:px-8">
        <div class="animate-pulse">
          <div class="h-7 bg-border-soft rounded w-48 mb-4" />
          <div class="h-40 bg-border-soft rounded-xl" />
        </div>
      </div>
    );
  }

  if (!course.value) {
    return (
      <div class="p-6 lg:px-8">
        <div class="ln-panel"><div class="ln-panel-body text-failure text-[13px]">{error.value || "Course not found"}</div></div>
      </div>
    );
  }

  return (
    <div class="p-6 lg:px-8 lg:pb-16 max-w-[900px]">
      {/* Page top */}
      <div class="flex items-center justify-between mb-[18px]">
        <div class="ln-breadcrumb">
          learn <span class="text-border-soft">/</span> manage <span class="text-border-soft">/</span> <b>edit</b>
        </div>
        <div class="flex items-center gap-2">
          {!course.value.is_published && (
            <button class="ln-btn ln-btn-primary text-[13px]" onClick$={publishCourse}>
              Publish
            </button>
          )}
          <Link href={`/courses/${course.value.slug}`} class="ln-btn ln-btn-outline text-[13px]">
            View Course
          </Link>
        </div>
      </div>

      <div class="ln-greet">
        <h1>Edit Course</h1>
      </div>

      {error.value && (
        <div class="mb-4 p-3 rounded-lg text-[13px] text-failure bg-[color-mix(in_oklch,var(--color-failure)_10%,transparent)] border border-[color-mix(in_oklch,var(--color-failure)_25%,transparent)]">
          {error.value}
        </div>
      )}

      {/* Course details */}
      <div class="ln-panel mb-6">
        <div class="ln-panel-head">
          <h3>Details</h3>
        </div>
        <div class="ln-panel-body">
          <div class="mb-4">
            <label class="ln-label">Title</label>
            <input
              type="text"
              class="ln-input"
              value={title.value}
              onInput$={(_, el) => { title.value = el.value; }}
            />
          </div>
          <div class="mb-4">
            <label class="ln-label">Description</label>
            <textarea
              class="ln-input min-h-[80px] resize-y"
              value={description.value}
              onInput$={(_, el) => { description.value = el.value; }}
            />
          </div>
          <label class="flex items-center gap-2.5 mb-4 cursor-pointer">
            <input
              type="checkbox"
              class="w-4 h-4 rounded border-border-soft bg-bg-2 text-accent focus:ring-accent/30"
              checked={isProtected.value}
              onChange$={(_, el) => { isProtected.value = el.checked; }}
            />
            <span class="text-[13px] text-muted">Protected</span>
          </label>
          <button
            class="ln-btn ln-btn-primary text-[13px]"
            disabled={saving.value}
            onClick$={saveCourse}
          >
            {saving.value ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Sections & Pages */}
      <div class="ln-panel">
        <div class="ln-panel-head">
          <h3>Sections & Pages</h3>
        </div>
        <div class="ln-panel-body">
          {(course.value.sections ?? []).map((section) => (
            <div key={section.id} class="mb-6 last:mb-0">
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-[14px] font-medium">{section.title}</h3>
                <button
                  class="ln-btn ln-btn-danger text-[11px] py-1 px-2"
                  onClick$={() => deleteSection(section.id)}
                >
                  Delete
                </button>
              </div>

              <div class="pl-4 border-l-2 border-border-soft space-y-0.5">
                {(section.pages ?? []).map((page) => (
                  <Link
                    key={page.id}
                    href={`/dashboard/courses/${courseId.value}/sections/${section.id}/pages/${page.id}`}
                    class="block text-[13px] text-muted hover:text-accent py-1.5 px-2 rounded-r transition-colors hover:bg-surface-hover"
                  >
                    {page.title}
                  </Link>
                ))}

                {/* Add page */}
                <div class="flex items-center gap-2 mt-2 pt-2">
                  <input
                    type="text"
                    placeholder="New page title..."
                    class="ln-input text-[12px] py-1.5 flex-1"
                    value={newPageTitle.value[section.id] ?? ""}
                    onInput$={(_, el) => {
                      newPageTitle.value = { ...newPageTitle.value, [section.id]: el.value };
                    }}
                  />
                  <button
                    class="ln-btn ln-btn-ghost text-[12px] text-accent"
                    disabled={addingPage.value[section.id]}
                    onClick$={() => addPage(section.id)}
                  >
                    Add Page
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add section */}
          <div class="flex items-center gap-2 mt-6 pt-4 border-t border-border-soft">
            <input
              type="text"
              placeholder="New section title..."
              class="ln-input flex-1"
              value={newSectionTitle.value}
              onInput$={(_, el) => { newSectionTitle.value = el.value; }}
            />
            <button
              class="ln-btn ln-btn-primary text-[13px]"
              disabled={addingSection.value}
              onClick$={addSection}
            >
              Add Section
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
