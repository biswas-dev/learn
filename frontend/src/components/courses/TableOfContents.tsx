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

    return (
      <nav class="space-y-5">
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
