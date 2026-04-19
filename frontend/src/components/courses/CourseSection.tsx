import { component$, Slot } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import type { CourseSummary } from "~/lib/types";
import { CourseCard } from "./CourseCard";

interface Props {
  title: string;
  icon?: string;
  courses: CourseSummary[];
  viewAllHref?: string;
  viewAllLabel?: string;
  maxShow?: number;
}

export const CourseSection = component$<Props>(
  ({ title, icon, courses, viewAllHref, viewAllLabel, maxShow = 6 }) => {
    if (!courses || courses.length === 0) return null;

    const visible = courses.slice(0, maxShow);

    return (
      <section class="mb-10">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-[14px] font-medium flex items-center gap-2">
            {icon && <span>{icon}</span>}
            {title}
          </h2>
          {viewAllHref && (
            <Link href={viewAllHref} class="ln-btn ln-btn-ghost text-[12px] text-accent">
              {viewAllLabel || `View All ${courses.length}`}
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6h8m0 0L6 2m4 4L6 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </Link>
          )}
        </div>
        <div class="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
          {visible.map((course) => (
            <div key={course.id} class="snap-start shrink-0 w-72">
              <CourseCard course={course} />
            </div>
          ))}
          <Slot />
        </div>
      </section>
    );
  }
);
