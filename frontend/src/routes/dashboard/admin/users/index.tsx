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

  // Get unique tag categories that have protected course content (for access grants)
  // Show all tags grouped by category for the access control
  const tagsByCategory = allTags.value.reduce<Record<string, Tag[]>>((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {});

  return (
    <div class="p-8">
      <h1 class="text-2xl font-bold text-text mb-2">Manage Users</h1>
      <p class="text-sm text-muted mb-6">
        Set roles and grant access to protected course collections.
      </p>

      {error.value && (
        <div class="mb-4 p-3 bg-failure/10 border border-failure/20 rounded-md text-sm text-failure">
          {error.value}
        </div>
      )}

      {loading.value && <p class="text-muted">Loading users...</p>}

      {!loading.value && (
        <div class="space-y-3">
          {users.value.map((user) => {
            const userTags = user.access_tags || [];
            return (
              <div
                key={user.id}
                class="border border-border rounded-lg p-4 hover:bg-surface-hover transition-colors"
              >
                <div class="flex items-center justify-between mb-3">
                  <div>
                    <span class="font-medium text-text">{user.display_name}</span>
                    <span class="text-muted text-sm ml-2">{user.email}</span>
                    <span class="text-muted text-xs ml-2">
                      joined {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <select
                    class="bg-surface border border-border rounded-md px-2 py-1 text-sm text-text focus:outline-none focus:border-accent"
                    value={user.role}
                    onChange$={(_, el) => {
                      updateRole(user.id, el.value as UserRole);
                    }}
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tag access grants */}
                <div class="flex flex-wrap gap-1.5">
                  <span class="text-xs text-muted mr-1 self-center">Access:</span>
                  {user.role === "admin" ? (
                    <span class="text-xs text-muted italic">admin — full access</span>
                  ) : (
                    <>
                      {Object.entries(tagsByCategory).map(([category, tags]) =>
                        tags.map((tag) => {
                          const hasAccess = userTags.some((ut) => ut.id === tag.id);
                          return (
                            <button
                              key={tag.id}
                              class={[
                                "text-xs px-2 py-0.5 rounded-full border transition-colors cursor-pointer",
                                hasAccess
                                  ? "bg-accent/20 border-accent text-accent"
                                  : "bg-surface border-border text-muted hover:border-accent/50",
                              ].join(" ")}
                              title={`${category}: ${tag.name}`}
                              onClick$={() =>
                                toggleTagAccess(user.id, tag.id, userTags)
                              }
                            >
                              {tag.name}
                            </button>
                          );
                        }),
                      )}
                      {allTags.value.length === 0 && (
                        <span class="text-xs text-muted italic">no tags available</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
