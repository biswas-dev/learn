import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { get } from "~/lib/api";
import type { Course } from "~/lib/types";

export default component$(() => {
  const courses = useSignal<Course[]>([]);
  const loading = useSignal(true);
  const error = useSignal("");

  useVisibleTask$(() => {
    get<Course[]>("/courses")
      .then((data) => {
        courses.value = data;
      })
      .catch((err) => {
        error.value = err.message;
      })
      .finally(() => {
        loading.value = false;
      });
  });

  return (
    <div class="p-8">
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-2xl font-bold text-text">My Courses</h1>
        <Link
          href="/dashboard/courses/new"
          class="px-4 py-2 bg-accent text-white text-sm rounded-md hover:bg-accent-hover transition-colors"
        >
          Create Course
        </Link>
      </div>

      {loading.value && <p class="text-muted">Loading...</p>}
      {error.value && <p class="text-failure">{error.value}</p>}

      {!loading.value && courses.value.length === 0 && !error.value && (
        <div class="text-center py-16">
          <p class="text-muted mb-4">No courses yet.</p>
          <Link
            href="/dashboard/courses/new"
            class="text-accent hover:text-accent-hover text-sm"
          >
            Create your first course
          </Link>
        </div>
      )}

      <div class="space-y-3">
        {courses.value.map((course) => (
          <Link
            key={course.id}
            href={`/dashboard/courses/${course.id}`}
            class="ln-card block border border-border bg-elevated rounded-lg p-4"
          >
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-text font-medium">{course.title}</h3>
                <p class="text-sm text-muted mt-1">
                  {course.slug} &middot;{" "}
                  {course.sections?.length ?? 0} sections
                </p>
              </div>
              <div class="flex items-center gap-3">
                {course.is_published ? (
                  <span class="text-xs px-2 py-0.5 bg-success/10 text-success rounded">
                    Published
                  </span>
                ) : (
                  <span class="text-xs px-2 py-0.5 bg-warning/10 text-warning rounded">
                    Draft
                  </span>
                )}
                {course.is_protected && (
                  <span class="text-xs px-2 py-0.5 bg-accent/10 text-accent rounded">
                    Protected
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
});
