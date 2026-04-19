import { component$, useSignal } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import { post } from "~/lib/api";
import type { Course } from "~/lib/types";

export default component$(() => {
  const title = useSignal("");
  const slug = useSignal("");
  const description = useSignal("");
  const isProtected = useSignal(false);
  const error = useSignal("");
  const loading = useSignal(false);
  const nav = useNavigate();

  return (
    <div class="p-6 lg:px-8 lg:pb-16 max-w-[700px]">
      {/* Page top */}
      <div class="flex items-center justify-between mb-[18px]">
        <div class="ln-breadcrumb">
          learn <span class="text-border-soft">/</span> <b>create course</b>
        </div>
      </div>

      <div class="ln-greet">
        <h1>Create Course</h1>
      </div>

      {error.value && (
        <div class="mb-4 p-3 rounded-lg text-[13px] text-failure bg-[color-mix(in_oklch,var(--color-failure)_10%,transparent)] border border-[color-mix(in_oklch,var(--color-failure)_25%,transparent)]">
          {error.value}
        </div>
      )}

      <div class="ln-panel">
        <div class="ln-panel-head">
          <h3>Course Details</h3>
        </div>
        <div class="ln-panel-body">
          <form
            preventdefault:submit
            onSubmit$={async () => {
              error.value = "";
              loading.value = true;
              try {
                const course = await post<Course>("/courses", {
                  title: title.value,
                  slug: slug.value,
                  description: description.value,
                  is_protected: isProtected.value,
                });
                nav(`/dashboard/courses/${course.id}`);
              } catch (err: any) {
                error.value = err.message || "Failed to create course";
              } finally {
                loading.value = false;
              }
            }}
          >
            <div class="mb-4">
              <label class="ln-label">Title</label>
              <input
                type="text"
                class="ln-input"
                value={title.value}
                onInput$={(_, el) => {
                  title.value = el.value;
                  if (!slug.value) {
                    slug.value = el.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "");
                  }
                }}
                required
              />
            </div>

            <div class="mb-4">
              <label class="ln-label">Slug</label>
              <input
                type="text"
                class="ln-input font-mono text-[13px]"
                value={slug.value}
                onInput$={(_, el) => { slug.value = el.value; }}
                required
              />
            </div>

            <div class="mb-4">
              <label class="ln-label">Description</label>
              <textarea
                class="ln-input min-h-[100px] resize-y"
                value={description.value}
                onInput$={(_, el) => { description.value = el.value; }}
              />
            </div>

            <label class="flex items-center gap-2.5 mb-6 cursor-pointer">
              <input
                type="checkbox"
                class="w-4 h-4 rounded border-border-soft bg-bg-2 text-accent focus:ring-accent/30"
                checked={isProtected.value}
                onChange$={(_, el) => { isProtected.value = el.checked; }}
              />
              <span class="text-[13px] text-muted">Protected (requires login to view)</span>
            </label>

            <button
              type="submit"
              class="ln-btn ln-btn-primary"
              disabled={loading.value}
            >
              {loading.value ? "Creating..." : "Create Course"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
});
