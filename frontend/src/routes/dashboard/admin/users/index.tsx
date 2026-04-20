import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { get, patch, put } from "~/lib/api";
import type { User, UserRole, Tag } from "~/lib/types";

export default component$(() => {
  const users = useSignal<User[]>([]);
  const allTags = useSignal<Tag[]>([]);
  const loading = useSignal(true);
  const error = useSignal("");

  useVisibleTask$(() => {
    Promise.all([
      get<User[]>("/admin/users"),
      get<Tag[]>("/tags"),
    ])
      .then(([userData, tagData]) => {
        users.value = userData;
        allTags.value = tagData;
      })
      .catch((err) => {
        error.value = err.message;
      })
      .finally(() => {
        loading.value = false;
      });
  });

  const updateRole = $(async (userId: number, role: UserRole) => {
    try {
      await patch(`/admin/users/${userId}/role`, { role });
      users.value = users.value.map((u) =>
        u.id === userId ? { ...u, role } : u,
      );
    } catch (err: any) {
      error.value = err.message;
    }
  });

  const toggleTagAccess = $(async (userId: number, tagId: number, currentTags: Tag[]) => {
    try {
      const has = currentTags.some((t) => t.id === tagId);
      const newTagIds = has
        ? currentTags.filter((t) => t.id !== tagId).map((t) => t.id)
        : [...currentTags.map((t) => t.id), tagId];
      const resp = await put<{ access_tags: Tag[] }>(`/admin/users/${userId}/tags`, { tag_ids: newTagIds });
      users.value = users.value.map((u) =>
        u.id === userId ? { ...u, access_tags: resp.access_tags || [] } : u,
      );
    } catch (err: any) {
      error.value = err.message;
    }
  });

  const roles: UserRole[] = ["admin", "editor", "commenter", "viewer"];

  // Source tags are access-control tags (e.g. "Educative")
  // Topic tags are everything else — not relevant for access control
  const sourceTags = allTags.value.filter((t) => t.category === "Source");

  return (
    <div style={{ padding: "24px 32px 64px", maxWidth: "1100px" }}>
      {/* Page top */}
      <div class="ln-breadcrumb" style={{ marginBottom: "18px" }}>
        learn <span style={{ color: "var(--color-rule)" }}>/</span> admin <span style={{ color: "var(--color-rule)" }}>/</span> <b>users</b>
      </div>

      <div class="ln-greet">
        <h1>Manage Users <em>{users.value.length}</em></h1>
        <p style={{ color: "var(--color-ink-3)", fontSize: "13.5px", marginTop: "4px" }}>Set roles and grant access to protected course collections.</p>
      </div>

      {error.value && (
        <div style={{
          marginBottom: "16px", padding: "12px", borderRadius: "3px", fontSize: "13px",
          color: "var(--color-failure)",
          background: "color-mix(in oklch, var(--color-failure) 10%, transparent)",
          border: "1px solid color-mix(in oklch, var(--color-failure) 25%, transparent)",
        }}>
          {error.value}
        </div>
      )}

      {loading.value && (
        <div class="animate-pulse" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1,2,3].map((i) => <div key={i} style={{ height: "64px", background: "var(--color-rule-soft)", borderRadius: "3px" }} />)}
        </div>
      )}

      {!loading.value && (
        <div class="ln-panel">
          <div class="ln-panel-body p0">
            <table class="ln-tbl">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Course Access</th>
                </tr>
              </thead>
              <tbody>
                {users.value.map((user) => {
                  const userTags = user.access_tags || [];
                  return (
                    <tr key={user.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{
                            width: "32px", height: "32px", borderRadius: "3px",
                            background: "var(--color-paper-2)", border: "1px solid var(--color-rule)",
                            display: "grid", placeItems: "center",
                            fontFamily: "var(--font-mono)", fontSize: "11px", fontWeight: 500,
                          }}>
                            {(user.display_name || user.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <b style={{ fontSize: "13px" }}>{user.display_name}</b>
                            <span class="mono" style={{ display: "block", color: "var(--color-ink-3)", fontSize: "10.5px", marginTop: "2px" }}>{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select
                          class="ln-input"
                          style={{ fontSize: "12px", width: "auto", padding: "4px 8px" }}
                          value={user.role}
                          onChange$={(_, el) => {
                            updateRole(user.id, el.value as UserRole);
                          }}
                        >
                          {roles.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span class="mono" style={{ fontSize: "11px", color: "var(--color-ink-3)" }}>
                          {new Date(user.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        {user.role === "admin" ? (
                          <span class="ln-pill ok">full access</span>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                            {sourceTags.map((tag) => {
                              const hasAccess = userTags.some((ut) => ut.id === tag.id);
                              return (
                                <button
                                  key={tag.id}
                                  onClick$={() => toggleTagAccess(user.id, tag.id, userTags)}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "5px 12px",
                                    borderRadius: "3px",
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                    background: hasAccess
                                      ? "color-mix(in oklch, var(--color-accent) 12%, transparent)"
                                      : "var(--color-paper-2)",
                                    color: hasAccess ? "var(--color-accent-ink)" : "var(--color-ink-3)",
                                    border: hasAccess
                                      ? "1px solid color-mix(in oklch, var(--color-accent) 30%, transparent)"
                                      : "1px solid var(--color-rule)",
                                  }}
                                >
                                  <span style={{
                                    width: "14px", height: "14px",
                                    borderRadius: "2px",
                                    border: hasAccess ? "none" : "1.5px solid var(--color-ink-4)",
                                    background: hasAccess ? "var(--color-accent)" : "transparent",
                                    display: "grid", placeItems: "center",
                                    flexShrink: 0,
                                  }}>
                                    {hasAccess && (
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M5 12l5 5L20 7"/>
                                      </svg>
                                    )}
                                  </span>
                                  {tag.name} library
                                </button>
                              );
                            })}
                            {sourceTags.length === 0 && (
                              <span class="mono" style={{ fontSize: "11px", color: "var(--color-ink-4)", fontStyle: "italic" }}>no source tags configured</span>
                            )}
                            {userTags.length === 0 && sourceTags.length > 0 && (
                              <span class="mono" style={{ fontSize: "10.5px", color: "var(--color-ink-4)" }}>no access</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});
