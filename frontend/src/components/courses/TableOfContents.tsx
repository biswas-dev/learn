import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import type { Section } from "~/lib/types";

interface Props {
  courseSlug: string;
  sections: Section[];
  currentPageSlug?: string;
  completedPageIds?: number[];
}

export const TableOfContents = component$<Props>(
  ({ courseSlug, sections, currentPageSlug, completedPageIds }) => {
    let globalPageIdx = 0;
    const completed = new Set(completedPageIds ?? []);

    // Calculate overall progress
    const totalPages = sections.reduce((sum, s) => sum + (s.pages?.length ?? 0), 0);
    const completedCount = sections.reduce(
      (sum, s) => sum + (s.pages ?? []).filter((p) => completed.has(p.id)).length, 0,
    );
    const progressPct = totalPages > 0 ? (completedCount / totalPages) * 100 : 0;

    // SVG progress ring
    const ringSize = 28;
    const ringStroke = 2.5;
    const ringRadius = (ringSize - ringStroke) / 2;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset = ringCircumference - (progressPct / 100) * ringCircumference;
    const ringColor = progressPct >= 100 ? "#34d399" : "#818cf8";

    return (
      <nav class="space-y-5">
        {/* Progress summary */}
        {totalPages > 0 && (
          <div class="flex items-center gap-3 pb-3 border-b border-border">
            <svg width={ringSize} height={ringSize} class="transform -rotate-90 shrink-0">
              <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke="#1e2235" stroke-width={ringStroke} />
              <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke={ringColor} stroke-width={ringStroke} stroke-linecap="round" stroke-dasharray={ringCircumference} stroke-dashoffset={ringOffset} class="transition-all duration-500" />
            </svg>
            <div>
              <span class="text-xs font-medium text-text">{completedCount} of {totalPages} pages</span>
              <span class="text-xs text-muted ml-1">({Math.round(progressPct)}%)</span>
            </div>
          </div>
        )}

        {sections.map((section, secIdx) => (
          <div key={section.id}>
            <h4 class="text-xs font-bold text-muted uppercase tracking-wider mb-2">
              {secIdx + 1}. {section.title}
            </h4>
            <ul class="space-y-0.5 border-l-2 border-border ml-1">
              {(section.pages ?? []).map((page) => {
                globalPageIdx++;
                const num = globalPageIdx;
                const active = page.slug === currentPageSlug;
                const done = completed.has(page.id);
                return (
                  <li key={page.id} class="relative">
                    {active && (
                      <div class="absolute left-[-2px] top-0 bottom-0 w-[2px] bg-accent" />
                    )}
                    <Link
                      href={`/courses/${courseSlug}/${section.slug}/${page.slug}`}
                      class={[
                        "flex items-start gap-2 text-sm py-1.5 px-3 rounded-r transition-colors",
                        active
                          ? "text-accent bg-accent/10 font-medium"
                          : "text-muted hover:text-text hover:bg-surface-hover",
                      ]}
                    >
                      <span class="shrink-0 mt-0.5 w-4 text-right">
                        {done ? (
                          <svg
                            class="w-3.5 h-3.5 text-success inline-block"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="2.5"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M4.5 12.75l6 6 9-13.5"
                            />
                          </svg>
                        ) : (
                          <span class="text-xs text-muted/60">{num}.</span>
                        )}
                      </span>
                      <span>{page.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    );
  },
);
