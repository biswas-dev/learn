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
    <div class="p-6 lg:px-8 lg:pb-16 max-w-[700px]">
      {/* Page top */}
      <div class="flex items-center justify-between mb-[18px]">
        <div class="ln-breadcrumb">
          learn <span class="text-border-soft">/</span> <b>import course</b>
        </div>
      </div>

      <div class="ln-greet">
        <h1>Import Course</h1>
        <p class="text-muted text-[13.5px] mt-1">Upload a .tar.gz archive from go-educative to import a course.</p>
      </div>

      {error.value && (
        <div class="mb-4 p-3 rounded-lg text-[13px] text-failure bg-[color-mix(in_oklch,var(--color-failure)_10%,transparent)] border border-[color-mix(in_oklch,var(--color-failure)_25%,transparent)]">
          {error.value}
        </div>
      )}

      <div class="ln-panel">
        <div class="ln-panel-head">
          <h3>Upload Archive</h3>
        </div>
        <div class="ln-panel-body">
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
            <label class="block mb-6 relative">
              <div class="flex items-center justify-center w-full border-2 border-dashed border-border-soft rounded-xl p-10 hover:border-[color-mix(in_oklch,var(--color-accent)_50%,transparent)] transition-colors cursor-pointer">
                <div class="text-center">
                  <svg
                    class="mx-auto w-8 h-8 text-subtle mb-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.4"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  <p class="text-[13px] text-muted">
                    {file.value ? file.value.name : "Click to select a .tar.gz file"}
                  </p>
                  {file.value && (
                    <p class="text-[11px] text-subtle font-mono mt-1">
                      {(file.value.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  )}
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
              class="ln-btn ln-btn-primary"
              disabled={loading.value || !file.value}
            >
              {loading.value ? "Importing..." : "Import Course"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
});
