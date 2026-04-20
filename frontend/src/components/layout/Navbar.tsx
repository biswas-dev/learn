import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link, useLocation, useNavigate } from "@builder.io/qwik-city";
import { clearToken } from "~/lib/api";
import type { User } from "~/lib/types";
import { SearchBar } from "~/components/search/SearchBar";

export const Navbar = component$(() => {
  const user = useSignal<User | null>(null);
  const loc = useLocation();
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

  const isLoggedIn = !!user.value;
  const pathname = loc.url.pathname;

  // Determine active tab
  const activeTab = pathname.startsWith("/dashboard")
    ? "dashboard"
    : pathname.startsWith("/courses/")
      ? "course"
      : pathname === "/library/" || pathname === "/library"
        ? "library"
        : "";

  // Logged-in nav with tabs
  if (isLoggedIn) {
    return (
      <nav class="ln-nav">
        <div class="ln-nav-inner">
          <Link href="/dashboard" class="ln-brand">
            <span class="ln-brand-mark">L</span>
            <span class="ln-brand-label">Learn</span>
          </Link>

          <div class="ln-nav-tabs">
            <Link
              href="/dashboard"
              class={`ln-nav-tab ${activeTab === "dashboard" ? "active" : ""}`}
            >
              Today
            </Link>
            <Link
              href="/dashboard"
              class={`ln-nav-tab ${activeTab === "library" ? "active" : ""}`}
            >
              Library
            </Link>
            {activeTab === "course" && (
              <span class="ln-nav-tab active">Reading</span>
            )}
          </div>

          <div style={{ flex: 1 }} />

          <SearchBar />

          <div class="flex items-center gap-3.5" style={{ fontSize: "12.5px" }}>
            {(user.value!.role === "admin" || user.value!.role === "editor") && (
              <Link
                href="/dashboard/manage"
                class="ln-nav-tab"
                style={{ padding: "6px 8px", fontSize: "12px" }}
              >
                Admin
              </Link>
            )}
            <button
              style={{ color: "var(--color-ink-3)", whiteSpace: "nowrap" }}
              onClick$={() => {
                clearToken();
                user.value = null;
                nav("/");
              }}
            >
              Sign&nbsp;out
            </button>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "var(--color-accent)",
                color: "var(--color-paper)",
                display: "grid",
                placeItems: "center",
                fontSize: "12px",
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              {user.value!.display_name?.charAt(0).toUpperCase() || "U"}
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Signed-out nav (for landing page)
  return (
    <header
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "22px 32px",
        display: "flex",
        alignItems: "center",
      }}
    >
      <Link href="/" class="ln-brand">
        <span class="ln-brand-mark">L</span>
        <span class="ln-brand-label">Learn</span>
      </Link>

      <nav
        style={{
          marginLeft: "48px",
          display: "flex",
          gap: "28px",
          fontSize: "13.5px",
          color: "var(--color-ink-2)",
        }}
      >
        <Link href="/dashboard">Library</Link>
        <a href="#how-it-works">How it works</a>
      </nav>

      <div style={{ flex: 1 }} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "18px",
          fontSize: "13.5px",
        }}
      >
        <Link
          href="/auth/login"
          style={{ color: "var(--color-ink-2)", whiteSpace: "nowrap" }}
        >
          Sign&nbsp;in
        </Link>
        <Link href="/dashboard" class="ln-btn ln-btn-primary">
          Open&nbsp;library
        </Link>
      </div>
    </header>
  );
});
