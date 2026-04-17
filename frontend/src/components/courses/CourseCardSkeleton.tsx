import { component$ } from "@builder.io/qwik";

export const CourseCardSkeleton = component$(() => {
  return (
    <div class="ln-card block p-5 animate-pulse">
      <div class="h-4 bg-border rounded w-3/4 mb-3" />
      <div class="h-3 bg-border rounded w-full mb-2" />
      <div class="h-3 bg-border rounded w-2/3 mb-4" />
      <div class="flex gap-2 mb-3">
        <div class="h-5 bg-border rounded w-16" />
        <div class="h-5 bg-border rounded w-12" />
      </div>
      <div class="flex gap-4 text-xs">
        <div class="h-3 bg-border rounded w-20" />
        <div class="h-3 bg-border rounded w-16" />
      </div>
    </div>
  );
});
