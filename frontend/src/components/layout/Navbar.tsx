import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link, useNavigate } from "@builder.io/qwik-city";
import { clearToken } from "~/lib/api";
import type { User } from "~/lib/types";
import { SearchBar } from "~/components/search/SearchBar";

export const Navbar = component$(() => {
  const user = useSignal<User | null>(null);
  const nav = useNavigate();

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
        .catch(() => {
          user.value = null;
        });
    }
  });

  return (
    <nav class="ln-nav">
      <div class="ln-nav-inner">
        <Link href="/" class="ln-brand">
          <span class="ln-brand-mark">L</span>
          <span>Learn</span>
        </Link>

        <div class="flex-1 flex items-center gap-4">
          <Link
            href="/dashboard"
            class="text-[13.5px] text-muted hover:text-text transition-colors px-3 py-1.5 rounded-[7px] hover:bg-surface"
          >
            Library
          </Link>
        </div>

        <div class="flex items-center gap-2">
          <SearchBar />

          {user.value ? (
            <>
              {(user.value.role === "admin" || user.value.role === "editor") && (
                <Link
                  href="/dashboard/manage"
                  class="ln-btn ln-btn-ghost text-[13px]"
                >
                  Admin
                </Link>
              )}
              <span class="text-[12px] text-subtle font-mono hidden sm:inline">
                {user.value.display_name}
              </span>
              <button
                class="ln-btn ln-btn-ghost text-[13px]"
                onClick$={() => {
                  clearToken();
                  user.value = null;
                  nav("/");
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" class="ln-btn ln-btn-ghost text-[13px]">
                Sign in
              </Link>
              <Link href="/auth/signup" class="ln-btn ln-btn-primary text-[13px]">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
});
