import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import type { User } from "~/lib/types";

export const Sidebar = component$(() => {
  const loc = useLocation();
  const user = useSignal<User | null>(null);

  useVisibleTask$(() => {
    const token = localStorage.getItem("learn_token");
    if (token) {
      fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((u) => {
          user.value = u;
        })
        .catch(() => {});
    }
  });

  const links = [
    { href: "/dashboard", label: "My Courses", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
    { href: "/dashboard/courses/new", label: "Create Course", icon: "M12 4.5v15m7.5-7.5h-15" },
    { href: "/dashboard/import", label: "Import Course", icon: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" },
  ];

  const isAdmin = user.value?.role === "admin";

  return (
    <aside class="w-56 shrink-0 border-r border-border bg-elevated/50 min-h-[calc(100vh-3.5rem)]">
      <nav class="p-4 flex flex-col gap-1">
        {links.map((link) => {
          const active = loc.url.pathname === link.href + "/";
          return (
            <Link
              key={link.href}
              href={link.href}
              class={[
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-text hover:bg-surface-hover",
              ]}
            >
              <svg
                class="w-4 h-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d={link.icon}
                />
              </svg>
              {link.label}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div class="border-t border-border my-3" />
            <Link
              href="/dashboard/admin/users"
              class={[
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                loc.url.pathname === "/dashboard/admin/users/"
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-text hover:bg-surface-hover",
              ]}
            >
              <svg
                class="w-4 h-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                />
              </svg>
              Manage Users
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
});
