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
    <div class="flex items-center justify-between mt-10 pt-6 border-t border-border-soft">
      {prev ? (
        <Link
          href={prev.href}
          class="flex items-center gap-2 text-[13px] text-muted hover:text-accent transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <span class="max-w-[200px] truncate">{prev.title}</span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={next.href}
          class="flex items-center gap-2 text-[13px] text-muted hover:text-accent transition-colors"
        >
          <span class="max-w-[200px] truncate">{next.title}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
});
