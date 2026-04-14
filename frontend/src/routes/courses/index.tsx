import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { get } from "~/lib/api";
import type { Course } from "~/lib/types";
import { CourseCard } from "~/components/courses/CourseCard";

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
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-text">Courses</h1>
        <p class="text-muted mt-2">Browse available courses and start learning.</p>
      </div>

      {loading.value && (
        <p class="text-muted">Loading courses...</p>
      )}

      {error.value && (
        <p class="text-failure">{error.value}</p>
      )}

      {!loading.value && courses.value.length === 0 && !error.value && (
        <p class="text-muted">No courses available yet.</p>
      )}

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.value.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </main>
  );
});
