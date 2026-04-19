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

  const tagsByCategory = allTags.value.reduce<Record<string, Tag[]>>((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {});

  return (
    <div class="p-6 lg:px-8 lg:pb-16 max-w-[1100px]">
      {/* Page top */}
      <div class="flex items-center justify-between mb-[18px]">
        <div class="ln-breadcrumb">
          learn <span class="text-border-soft">/</span> admin <span class="text-border-soft">/</span> <b>users</b>
        </div>
      </div>

      <div class="ln-greet">
        <h1>Manage Users <em>{users.value.length}</em></h1>
        <p class="text-muted text-[13.5px] mt-1">Set roles and grant access to protected course collections.</p>
      </div>

      {error.value && (
        <div class="mb-4 p-3 rounded-lg text-[13px] text-failure bg-[color-mix(in_oklch,var(--color-failure)_10%,transparent)] border border-[color-mix(in_oklch,var(--color-failure)_25%,transparent)]">
          {error.value}
        </div>
      )}

      {loading.value && (
        <div class="animate-pulse space-y-2">
          {[1,2,3].map((i) => <div key={i} class="h-16 bg-border-soft rounded-xl" />)}
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
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {users.value.map((user) => {
                  const userTags = user.access_tags || [];
                  return (
                    <tr key={user.id}>
                      <td>
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-[7px] bg-bg-2 border border-border-soft grid place-items-center font-mono text-[11px] text-muted font-medium">
                            {(user.display_name || user.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <b class="text-[13px]">{user.display_name}</b>
                            <span class="block text-subtle font-mono text-[10.5px] mt-0.5">{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select
                          class="ln-input text-[12px] w-auto py-1 px-2"
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
                      <td class="mono muted text-[11px]">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div class="flex flex-wrap gap-1">
                          {user.role === "admin" ? (
                            <span class="ln-pill ok">full access</span>
                          ) : (
                            <>
                              {Object.entries(tagsByCategory).map(([, tags]) =>
                                tags.map((tag) => {
                                  const hasAccess = userTags.some((ut) => ut.id === tag.id);
                                  return (
                                    <button
                                      key={tag.id}
                                      class={`ln-pill cursor-pointer ${hasAccess ? "ok" : ""}`}
                                      onClick$={() => toggleTagAccess(user.id, tag.id, userTags)}
                                    >
                                      {tag.name}
                                    </button>
                                  );
                                }),
                              )}
                              {allTags.value.length === 0 && (
                                <span class="text-subtle text-[11px] font-mono italic">no tags</span>
                              )}
                            </>
                          )}
                        </div>
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
