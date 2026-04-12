import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import type { Section } from "~/lib/types";

interface Props {
  courseSlug: string;
  sections: Section[];
  currentPageSlug?: string;
}

export const TableOfContents = component$<Props>(
  ({ courseSlug, sections, currentPageSlug }) => {
    return (
      <nav class="space-y-4">
        {sections.map((section) => (
          <div key={section.id}>
            <h4 class="text-sm font-semibold text-text mb-2">
              {section.title}
            </h4>
            <ul class="space-y-1 pl-3 border-l border-border">
              {(section.pages ?? []).map((page) => {
                const active = page.slug === currentPageSlug;
                return (
                  <li key={page.id}>
                    <Link
                      href={`/courses/${courseSlug}/${section.slug}/${page.slug}`}
                      class={[
                        "block text-sm py-1 px-2 rounded transition-colors",
                        active
                          ? "text-accent bg-accent/10"
                          : "text-muted hover:text-text hover:bg-surface-hover",
                      ]}
                    >
                      {page.title}
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
