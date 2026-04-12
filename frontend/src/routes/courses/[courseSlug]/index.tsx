import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { useLocation, Link } from "@builder.io/qwik-city";
import { get } from "~/lib/api";
import type { Course } from "~/lib/types";
import { TableOfContents } from "~/components/courses/TableOfContents";

export default component$(() => {
  const loc = useLocation();
  const course = useSignal<Course | null>(null);
  const loading = useSignal(true);
  const error = useSignal("");

  useVisibleTask$(() => {
    const slug = loc.params.courseSlug;
    get<Course>(`/courses/${slug}`)
      .then((data) => {
        course.value = data;
      })
      .catch((err) => {
        error.value = err.message;
      })
      .finally(() => {
        loading.value = false;
      });
  });

  if (loading.value) {
    return (
      <main class="max-w-4xl mx-auto px-4 py-10">
        <p class="text-muted">Loading course...</p>
      </main>
    );
  }

  if (error.value || !course.value) {
    return (
      <main class="max-w-4xl mx-auto px-4 py-10">
        <p class="text-failure">{error.value || "Course not found"}</p>
        <Link href="/" class="text-accent text-sm mt-2 inline-block">
          Back to courses
        </Link>
      </main>
    );
  }

  const c = course.value;
  const firstPage =
    c.sections?.[0]?.pages?.[0]
      ? `/courses/${c.slug}/${c.sections[0].slug}/${c.sections[0].pages[0].slug}`
      : null;

  return (
    <main class="max-w-4xl mx-auto px-4 py-10">
      <div class="mb-8">
        {c.cover_image_url && (
          <img
            src={c.cover_image_url}
            alt={c.title}
            class="w-full h-48 object-cover rounded-lg mb-6"
            width={800}
            height={192}
          />
        )}
        <h1 class="text-3xl font-bold text-text">{c.title}</h1>
        {c.description && (
          <p class="text-muted mt-2">{c.description}</p>
        )}
        {c.author_name && (
          <p class="text-sm text-muted mt-1">by {c.author_name}</p>
        )}
      </div>

      {firstPage && (
        <Link
          href={firstPage}
          class="inline-block mb-8 px-4 py-2 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          Start Reading
        </Link>
      )}

      {c.sections && c.sections.length > 0 && (
        <div class="border border-border rounded-lg bg-elevated p-6">
          <h2 class="text-lg font-semibold text-text mb-4">Table of Contents</h2>
          <TableOfContents courseSlug={c.slug} sections={c.sections} />
        </div>
      )}
    </main>
  );
});
