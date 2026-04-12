import { component$, useSignal } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";
import { upload } from "~/lib/api";
import type { Course } from "~/lib/types";

export default component$(() => {
  const file = useSignal<File | null>(null);
  const loading = useSignal(false);
  const error = useSignal("");
  const nav = useNavigate();

  return (
    <div class="p-8 max-w-2xl">
      <h1 class="text-2xl font-bold text-text mb-2">Import Course</h1>
      <p class="text-sm text-muted mb-6">
        Upload a .tar.gz archive from go-educative to import a course with all
        its sections and pages.
      </p>

      {error.value && (
        <div class="mb-4 p-3 bg-failure/10 border border-failure/20 rounded-md text-sm text-failure">
          {error.value}
        </div>
      )}

      <form
        preventdefault:submit
        onSubmit$={async () => {
          if (!file.value) {
            error.value = "Please select an archive file";
            return;
          }
          error.value = "";
          loading.value = true;
          try {
            const formData = new FormData();
            formData.append("archive", file.value);
            const course = await upload<Course>("/import/course", formData);
            nav(`/dashboard/courses/${course.id}`);
          } catch (err: any) {
            error.value = err.message || "Import failed";
          } finally {
            loading.value = false;
          }
        }}
      >
        <label class="block mb-6">
          <span class="text-sm text-muted">Archive File (.tar.gz)</span>
          <div class="mt-2 flex items-center justify-center w-full border-2 border-dashed border-border rounded-lg p-8 hover:border-accent/50 transition-colors">
            <div class="text-center">
              <svg
                class="mx-auto w-10 h-10 text-muted mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <p class="text-sm text-muted">
                {file.value ? file.value.name : "Click to select a file"}
              </p>
              <input
                type="file"
                accept=".tar.gz,.tgz"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange$={(_, el) => {
                  file.value = el.files?.[0] ?? null;
                }}
              />
            </div>
          </div>
        </label>

        <button
          type="submit"
          class="px-6 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          disabled={loading.value || !file.value}
        >
          {loading.value ? "Importing..." : "Import Course"}
        </button>
      </form>
    </div>
  );
});
