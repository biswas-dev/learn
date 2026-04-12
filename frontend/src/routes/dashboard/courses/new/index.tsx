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
    <div class="p-8 max-w-2xl">
      <h1 class="text-2xl font-bold text-text mb-6">Create Course</h1>

      {error.value && (
        <div class="mb-4 p-3 bg-failure/10 border border-failure/20 rounded-md text-sm text-failure">
          {error.value}
        </div>
      )}

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
        <label class="block mb-4">
          <span class="text-sm text-muted">Title</span>
          <input
            type="text"
            class="mt-1 block w-full bg-surface border border-border rounded-md px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
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
        </label>

        <label class="block mb-4">
          <span class="text-sm text-muted">Slug</span>
          <input
            type="text"
            class="mt-1 block w-full bg-surface border border-border rounded-md px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
            value={slug.value}
            onInput$={(_, el) => {
              slug.value = el.value;
            }}
            required
          />
        </label>

        <label class="block mb-4">
          <span class="text-sm text-muted">Description</span>
          <textarea
            class="mt-1 block w-full bg-surface border border-border rounded-md px-3 py-2 text-text text-sm focus:outline-none focus:border-accent min-h-[100px]"
            value={description.value}
            onInput$={(_, el) => {
              description.value = el.value;
            }}
          />
        </label>

        <label class="flex items-center gap-2 mb-6">
          <input
            type="checkbox"
            class="rounded border-border bg-surface text-accent focus:ring-accent"
            checked={isProtected.value}
            onChange$={(_, el) => {
              isProtected.value = el.checked;
            }}
          />
          <span class="text-sm text-muted">
            Protected (requires login to view)
          </span>
        </label>

        <button
          type="submit"
          class="px-6 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          disabled={loading.value}
        >
          {loading.value ? "Creating..." : "Create Course"}
        </button>
      </form>
    </div>
  );
});
