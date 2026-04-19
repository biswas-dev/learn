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

  const totalPages = courses.value.reduce(
    (acc, c) => acc + (c.page_count ?? c.sections?.reduce((a, s) => a + (s.pages?.length ?? 0), 0) ?? 0),
    0
  );
  const totalHours = Math.round((totalPages * 3) / 60);

  return (
    <>
      {/* Hero */}
      <section class="relative overflow-hidden py-[72px] pb-[88px]">
        {/* Grid background */}
        <div
          class="absolute inset-0 opacity-[0.45] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(var(--color-border-soft) 1px, transparent 1px), linear-gradient(90deg, var(--color-border-soft) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 20%, #000 30%, transparent 75%)",
          }}
        />
        <div class="max-w-[1280px] mx-auto px-7 relative">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <span class="ln-eyebrow">
                <span class="dot" />
                Self-hosted learning platform
                <span class="text-subtle bg-bg-2 px-2 py-0.5 rounded-full text-[11px]">v1.0</span>
              </span>
              <h1 class="ln-display">
                Your courses, your way — learn at your own <em>pace.</em>
              </h1>
              <p class="text-[17.5px] leading-[1.55] text-muted max-w-[540px] mb-7">
                A lightweight, self-hosted platform for organizing, reading, and sharing
                structured course content. Import from any source, track your progress,
                and own your learning data.
              </p>
              <div class="flex gap-2.5 items-center flex-wrap">
                <Link href="/dashboard" class="ln-btn ln-btn-primary">
                  Open the library
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8m0 0L6 2m4 4L6 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </Link>
                <Link href="/auth/signup" class="ln-btn ln-btn-outline">
                  Get started
                </Link>
                <span class="text-subtle text-[12.5px] font-mono ml-1.5">single Go binary &middot; SQLite &middot; your server</span>
              </div>

              <div class="ln-hero-stats">
                <div class="ln-hero-stat">
                  <b>{loading.value ? "..." : courses.value.length}</b>
                  <span>Courses</span>
                </div>
                <div class="ln-hero-stat">
                  <b>{loading.value ? "..." : `${totalHours}h`}</b>
                  <span>Reading time</span>
                </div>
                <div class="ln-hero-stat">
                  <b>{loading.value ? "..." : totalPages}</b>
                  <span>Total pages</span>
                </div>
              </div>
            </div>

            {/* Right side — course preview card */}
            {!loading.value && courses.value.length > 0 && (
              <div class="ln-panel">
                <div class="flex items-center gap-2.5 px-3.5 py-3 border-b border-border-soft font-mono text-[11.5px] text-subtle">
                  <div class="flex gap-[5px]">
                    <span class="w-[9px] h-[9px] rounded-full bg-border" />
                    <span class="w-[9px] h-[9px] rounded-full bg-border" />
                    <span class="w-[9px] h-[9px] rounded-full bg-border" />
                  </div>
                  <div class="flex-1"><b class="text-muted font-medium">learn</b> &middot; library / courses</div>
                  <span class="w-[7px] h-[7px] rounded-full bg-accent animate-pulse" />
                </div>
                <div class="flex border-b border-border-soft font-mono text-[11.5px] bg-bg-2">
                  <div class="px-3.5 py-2 text-text bg-surface border-r border-border-soft" style={{ boxShadow: "inset 0 -1px 0 var(--color-accent)" }}>
                    all courses <span class="text-[10px] text-subtle px-1 py-0.5 border border-border-soft rounded ml-1">{courses.value.length}</span>
                  </div>
                  <div class="px-3.5 py-2 text-subtle border-r border-border-soft">in progress</div>
                  <div class="px-3.5 py-2 text-subtle">recently viewed</div>
                </div>
                <div class="p-3.5">
                  {courses.value.slice(0, 4).map((course) => {
                    const pageCount = course.page_count ?? course.sections?.reduce((a, s) => a + (s.pages?.length ?? 0), 0) ?? 0;
                    return (
                      <Link
                        key={course.id}
                        href={`/courses/${course.slug}/`}
                        class="flex items-center gap-3 py-2.5 px-1 border-b border-dashed border-border-soft last:border-0 text-[12.5px] hover:bg-surface-hover rounded transition-colors"
                      >
                        <div class="w-[18px] h-[18px] rounded-full grid place-items-center text-[10px] bg-[color-mix(in_oklch,var(--color-accent)_22%,transparent)] text-accent shrink-0">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 6.253v13M6.5 5C5.254 5 4.168 5.477 3 6.253v13C4.168 18.477 5.254 18 6.5 18s3.332.477 4.5 1.253m0-13c1.168-.776 2.754-1.253 4.5-1.253s3.332.477 4.5 1.253v13c-1.168-.776-2.754-1.253-4.5-1.253s-3.332.477-4.5 1.253"/></svg>
                        </div>
                        <div class="min-w-0 flex-1">
                          <b class="font-medium block truncate">{course.title}</b>
                          <small class="text-subtle font-mono text-[10.5px] block mt-0.5 truncate">{course.description}</small>
                        </div>
                        <span class="font-mono text-[11px] text-muted shrink-0">{pageCount} pg</span>
                      </Link>
                    );
                  })}
                </div>
                <div class="px-3.5 py-2.5 border-t border-border-soft font-mono text-[11px] text-subtle flex justify-between bg-bg-2">
                  <span>{courses.value.length} courses available</span>
                  <span class="ln-liveping"><span class="d" /> live</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feature bento grid */}
      <section class="max-w-[1280px] mx-auto px-7 py-[88px]">
        <div class="mb-11">
          <span class="ln-section-kicker">Features</span>
          <h2 class="text-[clamp(30px,3.2vw,42px)] leading-[1.1] tracking-[-0.025em] font-semibold max-w-[760px]">
            Everything you need to <em class="font-serif italic font-normal text-muted">learn effectively.</em>
          </h2>
        </div>

        <div class="ln-bento">
          <div class="ln-bf c3">
            <div class="ln-bf-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"/></svg>
            </div>
            <h3>Structured content</h3>
            <p>Courses organized into sections and pages with a clear table of contents, making it easy to navigate complex material.</p>
          </div>
          <div class="ln-bf c3">
            <div class="ln-bf-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
            </div>
            <h3>Progress tracking</h3>
            <p>Pick up where you left off. Reading progress is saved automatically so you never lose your place across sessions.</p>
          </div>
          <div class="ln-bf c2">
            <div class="ln-bf-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25"/></svg>
            </div>
            <h3>Import anything</h3>
            <p>Bulk import courses from external sources with full-text search and versioning.</p>
          </div>
          <div class="ln-bf c2">
            <div class="ln-bf-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>
            </div>
            <h3>Access control</h3>
            <p>Protect content behind authentication with role-based access for reading, editing, or managing.</p>
          </div>
          <div class="ln-bf c2">
            <div class="ln-bf-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"/></svg>
            </div>
            <h3>Rich content</h3>
            <p>Full Markdown with syntax highlighting, math, images with lightbox zoom, and embedded code.</p>
          </div>

          <div class="ln-bf c4">
            <div class="ln-bf-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"/></svg>
            </div>
            <h3>Self-hosted &amp; lightweight</h3>
            <p>Runs on a single Go binary with SQLite. No external dependencies, no cloud lock-in. Your data stays on your infrastructure. Deploy anywhere with Docker or a standalone binary.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section class="max-w-[1280px] mx-auto px-7 py-[88px]">
        <div class="mb-11">
          <span class="ln-section-kicker">Getting started</span>
          <h2 class="text-[clamp(30px,3.2vw,42px)] leading-[1.1] tracking-[-0.025em] font-semibold">
            Four steps to <em class="font-serif italic font-normal text-muted">knowledge.</em>
          </h2>
        </div>

        <div class="ln-steps">
          <div class="ln-step">
            <div class="ln-step-num">step <b>01</b></div>
            <div class="ln-step-title">Deploy</div>
            <div class="ln-step-desc">Run the single Go binary or use Docker. SQLite included, no external database needed.</div>
          </div>
          <div class="ln-step">
            <div class="ln-step-num">step <b>02</b></div>
            <div class="ln-step-title">Import</div>
            <div class="ln-step-desc">Import courses from tar.gz archives, or create content directly in the built-in editor.</div>
          </div>
          <div class="ln-step">
            <div class="ln-step-num">step <b>03</b></div>
            <div class="ln-step-title">Read</div>
            <div class="ln-step-desc">Navigate structured content with a clean reader view, progress tracking, and bookmarks.</div>
          </div>
          <div class="ln-step">
            <div class="ln-step-num">step <b>04</b></div>
            <div class="ln-step-title">Track</div>
            <div class="ln-step-desc">See your progress across all courses. Pick up where you left off, every time.</div>
          </div>
        </div>
      </section>

      {/* Course preview */}
      {!loading.value && courses.value.length > 0 && (
        <section class="max-w-[1280px] mx-auto px-7 py-12">
          <div class="flex items-end justify-between mb-11">
            <div>
              <span class="ln-section-kicker">Library</span>
              <h2 class="text-[clamp(30px,3.2vw,42px)] leading-[1.1] tracking-[-0.025em] font-semibold">
                Available <em class="font-serif italic font-normal text-muted">courses.</em>
              </h2>
            </div>
            <Link href="/dashboard" class="ln-btn ln-btn-outline text-[13px]">
              View all
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8m0 0L6 2m4 4L6 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </Link>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.value.slice(0, 6).map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer class="ln-footer">
        <div class="max-w-[1280px] mx-auto px-7">
          <div class="ln-footer-inner">
            <div class="max-w-[320px]">
              <div class="flex items-center gap-2.5 mb-4">
                <span class="ln-brand-mark">L</span>
                <span class="font-semibold text-text">Learn</span>
              </div>
              <p class="text-muted text-[13px] leading-relaxed">
                A self-hosted learning platform. Import courses, track progress, own your data.
                Built with Go and SQLite.
              </p>
            </div>
            <div>
              <h5>Platform</h5>
              <Link href="/dashboard">Library</Link>
              <Link href="/dashboard/manage">Manage</Link>
              <Link href="/dashboard/import">Import</Link>
            </div>
            <div>
              <h5>Account</h5>
              <Link href="/auth/login">Sign in</Link>
              <Link href="/auth/signup">Create account</Link>
            </div>
            <div>
              <h5>Stack</h5>
              <span class="block py-1 text-muted">Go backend</span>
              <span class="block py-1 text-muted">SQLite database</span>
              <span class="block py-1 text-muted">Qwik frontend</span>
            </div>
          </div>
          <div class="ln-footer-bottom">
            <span>&copy; {new Date().getFullYear()} Learn</span>
            <span class="ln-liveping"><span class="d" /> online</span>
          </div>
        </div>
      </footer>
    </>
  );
});
