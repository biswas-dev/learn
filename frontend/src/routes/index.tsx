import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { get } from "~/lib/api";
import type { Course } from "~/lib/types";
import { CourseCard } from "~/components/courses/CourseCard";

export default component$(() => {
  const courses = useSignal<Course[]>([]);
  const loading = useSignal(true);

  useVisibleTask$(() => {
    get<Course[]>("/courses")
      .then((data) => {
        courses.value = data;
      })
      .catch(() => {})
      .finally(() => {
        loading.value = false;
      });
  });

  return (
    <>
      {/* Hero */}
      <section class="relative overflow-hidden">
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(129,140,248,0.12),transparent)]" />
        <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 relative">
          <div class="text-center">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/20 bg-accent/5 text-accent text-sm mb-6">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              Self-hosted learning platform
            </div>
            <h1 class="text-4xl sm:text-5xl font-bold text-text tracking-tight leading-tight">
              Your courses,{" "}
              <span class="bg-gradient-to-r from-accent to-success bg-clip-text text-transparent">
                your way
              </span>
            </h1>
            <p class="mt-4 text-lg text-muted max-w-2xl mx-auto leading-relaxed">
              A lightweight, self-hosted platform for organizing, reading, and sharing
              structured course content. Import from any source, track your progress,
              and learn at your own pace.
            </p>
            <div class="mt-8 flex items-center justify-center gap-4">
              <Link
                href="/courses"
                class="px-5 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover transition-colors"
              >
                Browse Courses
              </Link>
              <Link
                href="/auth/signup"
                class="px-5 py-2.5 border border-border text-muted font-medium rounded-lg hover:text-text hover:border-accent/40 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
              </svg>
            }
            title="Structured content"
            description="Courses are organized into sections and pages with a clear table of contents, making it easy to navigate complex material."
          />
          <FeatureCard
            icon={
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
            title="Progress tracking"
            description="Pick up where you left off. Reading progress is saved automatically so you never lose your place across sessions."
          />
          <FeatureCard
            icon={
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25" />
              </svg>
            }
            title="Import anything"
            description="Bulk import courses from external sources. Content is stored locally as Markdown with full-text search and versioning."
          />
          <FeatureCard
            icon={
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            }
            title="Access control"
            description="Protect sensitive content behind authentication. Role-based access lets you control who can read, edit, or manage courses."
          />
          <FeatureCard
            icon={
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            }
            title="Rich content"
            description="Full Markdown rendering with syntax highlighting, diagrams, images with lightbox zoom, and embedded drawings."
          />
          <FeatureCard
            icon={
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
              </svg>
            }
            title="Self-hosted"
            description="Runs on a single binary with SQLite. No external dependencies, no cloud lock-in. Your data stays on your infrastructure."
          />
        </div>
      </section>

      {/* Course preview */}
      {!loading.value && courses.value.length > 0 && (
        <section class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-text">Available Courses</h2>
            <Link
              href="/courses"
              class="text-sm text-accent hover:text-accent-hover transition-colors"
            >
              View all &rarr;
            </Link>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.value.slice(0, 3).map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer class="border-t border-border mt-16">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-between text-sm text-muted">
          <span>Learn &mdash; Self-hosted course platform</span>
          <span>Built with Go + Qwik</span>
        </div>
      </footer>
    </>
  );
});

interface FeatureCardProps {
  icon: any;
  title: string;
  description: string;
}

const FeatureCard = component$<FeatureCardProps>(({ icon, title, description }) => {
  return (
    <div class="p-5 rounded-lg border border-border bg-elevated/50 hover:border-accent/20 transition-colors">
      <div class="w-9 h-9 rounded-md bg-accent/10 flex items-center justify-center text-accent mb-3">
        {icon}
      </div>
      <h3 class="text-sm font-semibold text-text mb-1">{title}</h3>
      <p class="text-sm text-muted leading-relaxed">{description}</p>
    </div>
  );
});
