import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

interface NavLink {
  href: string;
  title: string;
}

interface Props {
  prev?: NavLink;
  next?: NavLink;
}

export const PageNavigation = component$<Props>(({ prev, next }) => {
  return (
    <div class="flex items-center justify-between mt-10 pt-6 border-t border-border">
      {prev ? (
        <Link
          href={prev.href}
          class="flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          <span>{prev.title}</span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={next.href}
          class="flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors"
        >
          <span>{next.title}</span>
          <svg
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
});
