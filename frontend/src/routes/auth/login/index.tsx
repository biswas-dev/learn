import { component$, useSignal } from "@builder.io/qwik";
import { useNavigate, Link } from "@builder.io/qwik-city";
import { post, setToken } from "~/lib/api";

export default component$(() => {
  const email = useSignal("");
  const password = useSignal("");
  const error = useSignal("");
  const loading = useSignal(false);
  const nav = useNavigate();

  return (
    <main class="flex min-h-[calc(100vh-57px)] items-center justify-center px-4">
      <div class="w-full max-w-sm">
        <div class="ln-panel">
          <div class="ln-panel-head">
            <h3>Sign in</h3>
          </div>
          <div class="ln-panel-body">
            {error.value && (
              <div class="mb-4 p-3 rounded-lg text-[13px] text-failure bg-[color-mix(in_oklch,var(--color-failure)_10%,transparent)] border border-[color-mix(in_oklch,var(--color-failure)_25%,transparent)]">
                {error.value}
              </div>
            )}

            <form
              preventdefault:submit
              onSubmit$={async () => {
                error.value = "";
                loading.value = true;
                try {
                  const resp = await post<{ token: string }>("/auth/login", {
                    email: email.value,
                    password: password.value,
                  });
                  setToken(resp.token);
                  nav("/dashboard");
                } catch (err: any) {
                  error.value = err.message || "Login failed";
                } finally {
                  loading.value = false;
                }
              }}
            >
              <div class="mb-4">
                <label class="ln-label">Email</label>
                <input
                  type="email"
                  class="ln-input"
                  value={email.value}
                  onInput$={(_, el) => { email.value = el.value; }}
                  required
                />
              </div>

              <div class="mb-6">
                <label class="ln-label">Password</label>
                <input
                  type="password"
                  class="ln-input"
                  value={password.value}
                  onInput$={(_, el) => { password.value = el.value; }}
                  required
                />
              </div>

              <button
                type="submit"
                class="ln-btn ln-btn-primary w-full justify-center"
                disabled={loading.value}
              >
                {loading.value ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <p class="mt-4 text-[13px] text-subtle text-center">
              Don't have an account?{" "}
              <Link href="/auth/signup" class="text-accent hover:text-accent-hover">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
});
