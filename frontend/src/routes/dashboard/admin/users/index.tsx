import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { get, patch } from "~/lib/api";
import type { User, UserRole } from "~/lib/types";

export default component$(() => {
  const users = useSignal<User[]>([]);
  const loading = useSignal(true);
  const error = useSignal("");

  useVisibleTask$(() => {
    get<User[]>("/admin/users")
      .then((data) => {
        users.value = data;
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

  const roles: UserRole[] = ["admin", "editor", "commenter", "viewer"];

  return (
    <div class="p-8">
      <h1 class="text-2xl font-bold text-text mb-6">Manage Users</h1>

      {error.value && (
        <div class="mb-4 p-3 bg-failure/10 border border-failure/20 rounded-md text-sm text-failure">
          {error.value}
        </div>
      )}

      {loading.value && <p class="text-muted">Loading users...</p>}

      {!loading.value && (
        <div class="border border-border rounded-lg overflow-hidden">
          <table class="w-full">
            <thead>
              <tr class="bg-elevated border-b border-border">
                <th class="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-3">
                  User
                </th>
                <th class="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-3">
                  Email
                </th>
                <th class="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-3">
                  Role
                </th>
                <th class="text-left text-xs font-medium text-muted uppercase tracking-wider px-4 py-3">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              {users.value.map((user) => (
                <tr key={user.id} class="hover:bg-surface-hover transition-colors">
                  <td class="px-4 py-3 text-sm text-text">
                    {user.display_name}
                  </td>
                  <td class="px-4 py-3 text-sm text-muted">{user.email}</td>
                  <td class="px-4 py-3">
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
                  </td>
                  <td class="px-4 py-3 text-sm text-muted">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
