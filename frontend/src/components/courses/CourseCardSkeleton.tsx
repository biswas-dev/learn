import { component$ } from "@builder.io/qwik";

export const CourseCardSkeleton = component$(() => {
  return (
    <div class="rounded-xl border border-border-soft bg-surface p-4 animate-pulse">
      <div class="h-4 bg-border-soft rounded w-3/4 mb-3" />
      <div class="h-3 bg-border-soft rounded w-full mb-2" />
      <div class="h-3 bg-border-soft rounded w-2/3 mb-4" />
      <div class="flex gap-2 mb-3">
        <div class="h-5 bg-border-soft rounded w-16" />
        <div class="h-5 bg-border-soft rounded w-12" />
      </div>
      <div class="flex gap-4">
        <div class="h-3 bg-border-soft rounded w-14" />
        <div class="h-3 bg-border-soft rounded w-10" />
      </div>
    </div>
  );
});
