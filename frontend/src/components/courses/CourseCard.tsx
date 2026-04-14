import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import type { Course } from "~/lib/types";

interface Props {
  course: Course;
}

export const CourseCard = component$<Props>(({ course }) => {
  const sectionCount = course.section_count ?? course.sections?.length ?? 0;
  const pageCount =
    course.page_count ?? course.sections?.reduce((acc, s) => acc + (s.pages?.length ?? 0), 0) ?? 0;

  return (
    <Link
      href={`/courses/${course.slug}/`}
      class="ln-card block rounded-lg border border-border bg-elevated p-5 no-underline text-inherit cursor-pointer"
    >
      {course.cover_image_url && (
        <img
          src={course.cover_image_url}
          alt={course.title}
          class="w-full h-40 object-cover rounded-md mb-4"
          width={400}
          height={160}
        />
      )}
      <h3 class="text-lg font-semibold text-text mb-1">{course.title}</h3>
      {course.description && (
        <p class="text-sm text-muted mb-3 line-clamp-2">
          {course.description}
        </p>
      )}
      <div class="flex items-center gap-4 text-xs text-muted">
        {course.author_name && <span>by {course.author_name}</span>}
        <span>
          {sectionCount} {sectionCount === 1 ? "section" : "sections"}
        </span>
        <span>
          {pageCount} {pageCount === 1 ? "page" : "pages"}
        </span>
      </div>
      {course.is_protected && (
        <span class="mt-3 inline-block text-xs px-2 py-0.5 bg-warning/10 text-warning rounded">
          Protected
        </span>
      )}
    </Link>
  );
});
