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

  // Edit fields
  const title = useSignal("");
  const description = useSignal("");
  const isProtected = useSignal(false);

  // New section
  const newSectionTitle = useSignal("");
  const addingSection = useSignal(false);

  // New page (keyed by section ID)
  const newPageTitle = useSignal<Record<number, string>>({});
  const addingPage = useSignal<Record<number, boolean>>({});

  const loadCourse = $(async () => {
    try {
      // Resolve courseId from URL (SSG params may be "_")
      const parts = window.location.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("courses");
      if (idx >= 0 && parts[idx + 1] && parts[idx + 1] !== "_") {
        courseId.value = parts[idx + 1];
      }
      const courses = await get<Course[]>("/courses");
      const c = courses.find((x) => String(x.id) === courseId.value);
      if (!c) throw new Error("Course not found");
      // Fetch full course with sections by slug
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

  useVisibleTask$(() => {
    loadCourse();
  });

  const saveCourse = $(async () => {
    saving.value = true;
    try {
      await put<Course>(`/courses/${courseId.value}`, {
        title: title.value,
        description: description.value,
        is_protected: isProtected.value,
      });
      if (course.value) {
        course.value = {
          ...course.value,
          title: title.value,
          description: description.value,
          is_protected: isProtected.value,
        };
      }
    } catch (err: any) {
      error.value = err.message;
    } finally {
      saving.value = false;
    }
  });

  const addSection = $(async () => {
    if (!newSectionTitle.value.trim()) return;
    addingSection.value = true;
    try {
      const slug = newSectionTitle.value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      await post<Section>(`/courses/${courseId}/sections`, {
        title: newSectionTitle.value,
        slug,
      });
      newSectionTitle.value = "";
      loading.value = true;
      await loadCourse();
    } catch (err: any) {
      error.value = err.message;
    } finally {
      addingSection.value = false;
    }
  });

  const addPage = $(async (sectionId: number) => {
    const pageTitle = newPageTitle.value[sectionId]?.trim();
    if (!pageTitle) return;
    addingPage.value = { ...addingPage.value, [sectionId]: true };
    try {
      const slug = pageTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      await post<Page>(`/sections/${sectionId}/pages`, {
        title: pageTitle,
        slug,
      });
      newPageTitle.value = { ...newPageTitle.value, [sectionId]: "" };
      loading.value = true;
      await loadCourse();
    } catch (err: any) {
      error.value = err.message;
    } finally {
      addingPage.value = { ...addingPage.value, [sectionId]: false };
    }
  });

  const deleteSection = $(async (sectionId: number) => {
    if (!confirm("Delete this section and all its pages?")) return;
    try {
      await del(`/sections/${sectionId}`);
      loading.value = true;
      await loadCourse();
    } catch (err: any) {
      error.value = err.message;
    }
  });

  const publishCourse = $(async () => {
    try {
      await post(`/courses/${courseId}/publish`, {});
      loading.value = true;
      await loadCourse();
    } catch (err: any) {
      error.value = err.message;
    }
  });

  if (loading.value) {
    return <div class="p-8"><p class="text-muted">Loading...</p></div>;
  }

  if (!course.value) {
    return <div class="p-8"><p class="text-failure">{error.value || "Course not found"}</p></div>;
  }

  return (
    <div class="p-8 max-w-4xl">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-text">Edit Course</h1>
        <div class="flex items-center gap-3">
          {!course.value.is_published && (
            <button
              class="px-4 py-2 bg-success/10 text-success text-sm rounded-md hover:bg-success/20 transition-colors"
              onClick$={publishCourse}
            >
              Publish
            </button>
          )}
          <Link
            href={`/courses/${course.value.slug}`}
            class="text-sm text-accent hover:text-accent-hover"
          >
            View Course
          </Link>
        </div>
      </div>

      {error.value && (
        <div class="mb-4 p-3 bg-failure/10 border border-failure/20 rounded-md text-sm text-failure">
          {error.value}
        </div>
      )}

      {/* Course details form */}
      <div class="border border-border rounded-lg bg-elevated p-6 mb-8">
        <h2 class="text-lg font-semibold text-text mb-4">Details</h2>
        <label class="block mb-4">
          <span class="text-sm text-muted">Title</span>
          <input
            type="text"
            class="mt-1 block w-full bg-surface border border-border rounded-md px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
            value={title.value}
            onInput$={(_, el) => {
              title.value = el.value;
            }}
          />
        </label>
        <label class="block mb-4">
          <span class="text-sm text-muted">Description</span>
          <textarea
            class="mt-1 block w-full bg-surface border border-border rounded-md px-3 py-2 text-text text-sm focus:outline-none focus:border-accent min-h-[80px]"
            value={description.value}
            onInput$={(_, el) => {
              description.value = el.value;
            }}
          />
        </label>
        <label class="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={isProtected.value}
            onChange$={(_, el) => {
              isProtected.value = el.checked;
            }}
          />
          <span class="text-sm text-muted">Protected</span>
        </label>
        <button
          class="px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50"
          disabled={saving.value}
          onClick$={saveCourse}
        >
          {saving.value ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Sections & Pages */}
      <div class="border border-border rounded-lg bg-elevated p-6">
        <h2 class="text-lg font-semibold text-text mb-4">Sections & Pages</h2>

        {(course.value.sections ?? []).map((section) => (
          <div key={section.id} class="mb-6 last:mb-0">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-medium text-text">{section.title}</h3>
              <button
                class="text-xs text-failure/70 hover:text-failure transition-colors"
                onClick$={() => deleteSection(section.id)}
              >
                Delete
              </button>
            </div>

            <div class="pl-4 border-l border-border space-y-1">
              {(section.pages ?? []).map((page) => (
                <Link
                  key={page.id}
                  href={`/dashboard/courses/${courseId.value}/sections/${section.id}/pages/${page.id}`}
                  class="block text-sm text-muted hover:text-accent py-1 transition-colors"
                >
                  {page.title}
                </Link>
              ))}

              {/* Add page */}
              <div class="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  placeholder="New page title..."
                  class="flex-1 bg-surface border border-border rounded-md px-2 py-1 text-text text-sm focus:outline-none focus:border-accent"
                  value={newPageTitle.value[section.id] ?? ""}
                  onInput$={(_, el) => {
                    newPageTitle.value = {
                      ...newPageTitle.value,
                      [section.id]: el.value,
                    };
                  }}
                />
                <button
                  class="px-3 py-1 bg-accent/10 text-accent text-xs rounded-md hover:bg-accent/20 transition-colors disabled:opacity-50"
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
        <div class="flex items-center gap-2 mt-6 pt-4 border-t border-border">
          <input
            type="text"
            placeholder="New section title..."
            class="flex-1 bg-surface border border-border rounded-md px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
            value={newSectionTitle.value}
            onInput$={(_, el) => {
              newSectionTitle.value = el.value;
            }}
          />
          <button
            class="px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50"
            disabled={addingSection.value}
            onClick$={addSection}
          >
            Add Section
          </button>
        </div>
      </div>
    </div>
  );
});
