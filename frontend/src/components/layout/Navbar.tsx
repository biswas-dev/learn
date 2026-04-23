import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
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
  const search = loc.url.search;
  const activeTab = pathname.startsWith("/dashboard") && search.includes("view=library")
    ? "library"
    : pathname.startsWith("/dashboard")
      ? "dashboard"
      : pathname.startsWith("/courses/")
        ? "course"
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
              href="/dashboard?view=library"
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
              <AdminMenu />
            )}
            <Link
              href="/dashboard/api-keys"
              style={{ color: "var(--color-ink-3)", whiteSpace: "nowrap", textDecoration: "none" }}
            >
              API&nbsp;Keys
            </Link>
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

const AdminMenu = component$(() => {
  const open = useSignal(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick$={() => { open.value = !open.value; }}
        class="ln-nav-tab"
        style={{
          padding: "6px 8px",
          fontSize: "12px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          border: open.value ? "1px solid var(--color-rule)" : "1px solid transparent",
          borderRadius: "3px",
        }}
      >
        Admin
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open.value && (
        <>
          <div
            onClick$={() => { open.value = false; }}
            style={{ position: "fixed", inset: 0, zIndex: 59 }}
          />
          <div style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 60,
            background: "var(--color-paper)",
            border: "1px solid var(--color-rule)",
            borderRadius: "3px",
            boxShadow: "0 8px 24px -8px rgba(0,0,0,0.12)",
            minWidth: "180px",
            padding: "4px",
          }}>
            <Link
              href="/dashboard/manage"
              onClick$={() => { open.value = false; }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                fontSize: "13px",
                color: "var(--color-ink-2)",
                borderRadius: "2px",
                transition: "background 0.1s",
              }}
              onMouseEnter$={(e: MouseEvent) => { (e.currentTarget as HTMLElement).style.background = "var(--color-paper-2)"; }}
              onMouseLeave$={(e: MouseEvent) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 6.253v13M6.5 5C5.254 5 4.168 5.477 3 6.253v13C4.168 18.477 5.254 18 6.5 18s3.332.477 4.5 1.253m0-13c1.168-.776 2.754-1.253 4.5-1.253s3.332.477 4.5 1.253v13c-1.168-.776-2.754-1.253-4.5-1.253s-3.332.477-4.5 1.253"/>
              </svg>
              Manage Courses
            </Link>
            <Link
              href="/dashboard/admin/stats"
              onClick$={() => { open.value = false; }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                fontSize: "13px",
                color: "var(--color-ink-2)",
                borderRadius: "2px",
                transition: "background 0.1s",
              }}
              onMouseEnter$={(e: MouseEvent) => { (e.currentTarget as HTMLElement).style.background = "var(--color-paper-2)"; }}
              onMouseLeave$={(e: MouseEvent) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>
              </svg>
              System Stats
            </Link>
            <Link
              href="/dashboard/admin/users"
              onClick$={() => { open.value = false; }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                fontSize: "13px",
                color: "var(--color-ink-2)",
                borderRadius: "2px",
                transition: "background 0.1s",
              }}
              onMouseEnter$={(e: MouseEvent) => { (e.currentTarget as HTMLElement).style.background = "var(--color-paper-2)"; }}
              onMouseLeave$={(e: MouseEvent) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/>
              </svg>
              Manage Users
            </Link>
            <div style={{ borderTop: "1px solid var(--color-rule-soft)", margin: "4px 0" }}/>
            <Link
              href="/dashboard/import"
              onClick$={() => { open.value = false; }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                fontSize: "13px",
                color: "var(--color-ink-2)",
                borderRadius: "2px",
                transition: "background 0.1s",
              }}
              onMouseEnter$={(e: MouseEvent) => { (e.currentTarget as HTMLElement).style.background = "var(--color-paper-2)"; }}
              onMouseLeave$={(e: MouseEvent) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
              </svg>
              Import Course
            </Link>
            <Link
              href="/dashboard/courses/new"
              onClick$={() => { open.value = false; }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                fontSize: "13px",
                color: "var(--color-ink-2)",
                borderRadius: "2px",
                transition: "background 0.1s",
              }}
              onMouseEnter$={(e: MouseEvent) => { (e.currentTarget as HTMLElement).style.background = "var(--color-paper-2)"; }}
              onMouseLeave$={(e: MouseEvent) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 4.5v15m7.5-7.5h-15"/>
              </svg>
              Create Course
            </Link>
          </div>
        </>
      )}
    </div>
  );
});
