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
    <nav class="border-b border-border bg-elevated/80 backdrop-blur-sm sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
        <div class="flex items-center gap-6">
          <Link href="/" class="text-lg font-bold text-accent">
            Learn
          </Link>
          <Link
            href="/dashboard"
            class="text-sm text-muted hover:text-text transition-colors"
          >
            Library
          </Link>
        </div>

        <div class="flex items-center gap-4">
          <SearchBar />

          {user.value ? (
            <>
              {(user.value.role === "admin" || user.value.role === "editor") && (
                <Link
                  href="/dashboard/courses/new"
                  class="text-sm text-muted hover:text-text transition-colors"
                >
                  Admin
                </Link>
              )}
              <span class="text-sm text-muted hidden sm:inline">
                {user.value.display_name}
              </span>
              <button
                class="text-sm text-muted hover:text-failure transition-colors"
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
              <Link
                href="/auth/login"
                class="text-sm text-muted hover:text-text transition-colors"
              >
                Login
              </Link>
              <Link
                href="/auth/signup"
                class="text-sm px-3 py-1.5 bg-accent text-white rounded-md hover:bg-accent-hover transition-colors"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
});
