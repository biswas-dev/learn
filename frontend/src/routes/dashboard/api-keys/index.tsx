import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { Link, type StaticGenerateHandler } from "@builder.io/qwik-city";
import { get, post, del } from "~/lib/api";

export const onStaticGenerate: StaticGenerateHandler = async () => {
  return { params: [] };
};

interface APIKey {
  id: number;
  name: string;
  key_prefix: string;
  expires_at: string;
  created_at: string;
}

interface NewKeyResponse {
  id: number;
  name: string;
  key: string;
  key_prefix: string;
  expires_at?: string;
}

export default component$(() => {
  const keys = useSignal<APIKey[]>([]);
  const loading = useSignal(true);
  const error = useSignal("");

  // New key form
  const newName = useSignal("");
  const newExpiry = useSignal("never");
  const creating = useSignal(false);

  // Freshly created key (view-once)
  const freshKey = useSignal<NewKeyResponse | null>(null);
  const copied = useSignal(false);

  const loadKeys = $(async () => {
    try {
      keys.value = await get<APIKey[]>("/api-keys");
    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  });

  useVisibleTask$(() => {
    loadKeys();
  });

  const createKey = $(async () => {
    if (!newName.value.trim()) {
      error.value = "Name is required";
      return;
    }
    creating.value = true;
    error.value = "";
    try {
      const result = await post<NewKeyResponse>("/api-keys", {
        name: newName.value.trim(),
        expires_in: newExpiry.value,
      });
      freshKey.value = result;
      copied.value = false;
      newName.value = "";
      newExpiry.value = "never";
      await loadKeys();
    } catch (err: any) {
      error.value = err.message;
    } finally {
      creating.value = false;
    }
  });

  const deleteKey = $(async (id: number, name: string) => {
    if (!confirm(`Delete API key "${name}"? This cannot be undone.`)) return;
    try {
      await del(`/api-keys/${id}`);
      keys.value = keys.value.filter((k) => k.id !== id);
      if (freshKey.value?.id === id) freshKey.value = null;
    } catch (err: any) {
      error.value = err.message;
    }
  });

  const copyKey = $(() => {
    if (freshKey.value) {
      navigator.clipboard.writeText(freshKey.value.key);
      copied.value = true;
    }
  });

  const isExpired = (expiresAt: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const formatDate = (d: string) => {
    if (!d) return "never";
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 32px 80px" }}>
      <div class="ln-breadcrumb" style={{ marginBottom: "24px" }}>
        <Link href="/dashboard">Dashboard</Link>
        <span style={{ margin: "0 8px" }}>/</span>
        <span style={{ color: "var(--color-ink)" }}>API Keys</span>
      </div>

      <h1 class="serif" style={{ fontSize: "32px", margin: "0 0 8px", fontWeight: 400 }}>API Keys</h1>
      <p style={{ fontSize: "14px", color: "var(--color-ink-3)", marginBottom: "32px" }}>
        Use API keys to access the search API from scripts, bots, or other tools.
        Keys are shown <strong>only once</strong> when created — copy them immediately.
      </p>

      {error.value && (
        <div class="ln-panel" style={{ marginBottom: "16px" }}>
          <div class="ln-panel-body" style={{ color: "var(--color-failure)", fontSize: "13px" }}>{error.value}</div>
        </div>
      )}

      {/* Fresh key banner */}
      {freshKey.value && (
        <div style={{
          padding: "16px 20px", marginBottom: "24px",
          background: "color-mix(in oklch, var(--color-accent) 8%, transparent)",
          border: "1px solid color-mix(in oklch, var(--color-accent) 30%, transparent)",
          borderRadius: "3px",
        }}>
          <div class="mono" style={{
            fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase",
            color: "var(--color-accent-ink)", marginBottom: "8px", fontWeight: 600,
          }}>
            New key created — copy now, it won't be shown again
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <code style={{
              flex: 1, fontSize: "13px", padding: "8px 12px",
              background: "var(--color-paper)", border: "1px solid var(--color-rule)",
              borderRadius: "2px", wordBreak: "break-all", userSelect: "all",
            }}>
              {freshKey.value.key}
            </code>
            <button onClick$={copyKey} class="ln-btn ln-btn-primary" style={{ padding: "8px 14px", fontSize: "12px", whiteSpace: "nowrap" }}>
              {copied.value ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Create new key */}
      <div class="ln-panel" style={{ marginBottom: "32px" }}>
        <div class="ln-panel-head">
          <h3>Create new key</h3>
        </div>
        <div class="ln-panel-body" style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px" }}>
            <label class="mono" style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", display: "block", marginBottom: "4px" }}>
              Name
            </label>
            <input
              type="text"
              value={newName.value}
              onInput$={(e: InputEvent) => { newName.value = (e.target as HTMLInputElement).value; }}
              placeholder="e.g. hermes-bot, ci-script"
              style={{
                width: "100%", padding: "8px 10px", fontSize: "13px",
                border: "1px solid var(--color-rule)", borderRadius: "2px",
                background: "var(--color-paper)", color: "var(--color-ink)",
              }}
            />
          </div>
          <div style={{ flex: "0 0 140px" }}>
            <label class="mono" style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", display: "block", marginBottom: "4px" }}>
              Expires
            </label>
            <select
              value={newExpiry.value}
              onChange$={(e: Event) => { newExpiry.value = (e.target as HTMLSelectElement).value; }}
              style={{
                width: "100%", padding: "8px 10px", fontSize: "13px",
                border: "1px solid var(--color-rule)", borderRadius: "2px",
                background: "var(--color-paper)", color: "var(--color-ink)",
              }}
            >
              <option value="never">Never</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
              <option value="1y">1 year</option>
            </select>
          </div>
          <button
            onClick$={createKey}
            disabled={creating.value}
            class="ln-btn ln-btn-primary"
            style={{ padding: "8px 16px", fontSize: "13px" }}
          >
            {creating.value ? "Creating..." : "Create key"}
          </button>
        </div>
      </div>

      {/* Keys list */}
      <div class="ln-panel">
        <div class="ln-panel-head">
          <h3>Your keys</h3>
        </div>
        <div class="ln-panel-body p0">
          {loading.value ? (
            <div class="animate-pulse" style={{ padding: "20px" }}>
              <div style={{ height: "16px", background: "var(--color-rule-soft)", borderRadius: "3px", width: "60%", marginBottom: "12px" }} />
              <div style={{ height: "16px", background: "var(--color-rule-soft)", borderRadius: "3px", width: "40%" }} />
            </div>
          ) : keys.value.length === 0 ? (
            <div style={{ padding: "24px", fontSize: "13px", color: "var(--color-ink-3)", textAlign: "center" }}>
              No API keys yet. Create one above.
            </div>
          ) : (
            <table class="ln-tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Expires</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {keys.value.map((k) => (
                  <tr key={k.id} style={{ opacity: isExpired(k.expires_at) ? 0.4 : 1 }}>
                    <td style={{ fontWeight: 500 }}>{k.name}</td>
                    <td>
                      <code class="mono" style={{ fontSize: "12px", color: "var(--color-ink-3)" }}>{k.key_prefix}...{'*'.repeat(20)}</code>
                    </td>
                    <td>
                      {isExpired(k.expires_at) ? (
                        <span class="ln-pill fail">expired</span>
                      ) : k.expires_at ? (
                        <span class="mono" style={{ fontSize: "12px" }}>{formatDate(k.expires_at)}</span>
                      ) : (
                        <span class="mono" style={{ fontSize: "12px", color: "var(--color-ink-4)" }}>never</span>
                      )}
                    </td>
                    <td>
                      <span class="mono" style={{ fontSize: "12px", color: "var(--color-ink-3)" }}>{formatDate(k.created_at)}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        onClick$={() => deleteKey(k.id, k.name)}
                        style={{
                          fontSize: "12px", color: "var(--color-failure)", cursor: "pointer",
                          background: "none", border: "none", padding: "4px 8px",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Usage hint */}
      <div style={{ marginTop: "24px", padding: "16px 20px", background: "var(--color-paper-2)", border: "1px solid var(--color-rule)", borderRadius: "3px" }}>
        <div class="mono" style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: "8px" }}>
          Usage
        </div>
        <code style={{ fontSize: "12px", color: "var(--color-ink-2)", wordBreak: "break-all" }}>
          curl 'https://learn.biswas.me/api/search/semantic?q=your+query' -H 'Authorization: ApiKey lrn_...'
        </code>
      </div>
    </main>
  );
});
