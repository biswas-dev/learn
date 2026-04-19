import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import type { Course, CourseSummary } from "~/lib/types";
import { TagBadge } from "./TagBadge";

interface Props {
  course: Course | CourseSummary;
}

function isSummary(c: Course | CourseSummary): c is CourseSummary {
  return "total_pages" in c;
}

export const CourseCard = component$<Props>(({ course }) => {
  const pageCount =
    isSummary(course) ? course.total_pages :
    course.page_count ?? course.sections?.reduce((acc, s) => acc + (s.pages?.length ?? 0), 0) ?? 0;

  const progressPct = isSummary(course) ? course.progress_pct : 0;
  const tags = isSummary(course) ? course.tags : undefined;
  const readingMins = Math.max(1, Math.round(pageCount * 3));

  return (
    <Link
      href={`/courses/${course.slug}/`}
      class="ln-card block rounded-xl border border-border-soft bg-surface p-4 no-underline text-inherit cursor-pointer relative overflow-hidden h-full"
    >
      {/* Progress indicator line at top */}
      {progressPct > 0 && (
        <div class="absolute inset-x-0 top-0 h-[3px] bg-bg-2">
          <div
            class="h-full bg-accent transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Progress badge */}
      {progressPct > 0 && (
        <span class="absolute top-3 right-3 ln-pill ok">
          {Math.round(progressPct)}%
        </span>
      )}

      {course.cover_image_url && (
        <img
          src={course.cover_image_url}
          alt={course.title}
          class="w-full h-36 object-cover rounded-lg mb-3"
          width={400}
          height={144}
          loading="lazy"
        />
      )}

      <h3 class="text-[13px] font-medium text-text mb-1 line-clamp-2 leading-snug">{course.title}</h3>

      {course.description && (
        <p class="text-[11.5px] text-muted mb-3 line-clamp-2">{course.description}</p>
      )}

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div class="flex flex-wrap gap-1 mb-3">
          {tags.slice(0, 2).map((tag) => (
            <TagBadge key={tag.id} name={tag.name} category={tag.category} />
          ))}
          {tags.length > 2 && (
            <span class="font-mono text-[10.5px] text-subtle px-1">+{tags.length - 2}</span>
          )}
        </div>
      )}

      {/* Metadata row */}
      <div class="flex items-center gap-3 font-mono text-[11px] text-subtle mt-auto">
        <span class="flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          {readingMins < 60 ? `${readingMins}m` : `${Math.round(readingMins / 60)}h ${readingMins % 60}m`}
        </span>
        <span>{pageCount} pg</span>
        {course.created_at && (
          <span>{new Date(course.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        )}
      </div>
    </Link>
  );
});
