import { component$, useSignal } from "@builder.io/qwik";
import { useNavigate, Link } from "@builder.io/qwik-city";
import { post, setToken } from "~/lib/api";

export default component$(() => {
  const email = useSignal("");
  const displayName = useSignal("");
  const password = useSignal("");
  const error = useSignal("");
  const loading = useSignal(false);
  const nav = useNavigate();

  return (
    <main class="flex min-h-[calc(100vh-57px)] items-center justify-center px-4">
      <div class="w-full max-w-sm">
        <div class="ln-panel">
          <div class="ln-panel-head">
            <h3>Create account</h3>
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
                  const resp = await post<{ token: string }>("/auth/signup", {
                    email: email.value,
                    display_name: displayName.value,
                    password: password.value,
                  });
                  setToken(resp.token);
                  nav("/dashboard");
                } catch (err: any) {
                  error.value = err.message || "Signup failed";
                } finally {
                  loading.value = false;
                }
              }}
            >
              <div class="mb-4">
                <label class="ln-label">Display Name</label>
                <input
                  type="text"
                  class="ln-input"
                  value={displayName.value}
                  onInput$={(_, el) => { displayName.value = el.value; }}
                  required
                />
              </div>

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
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                class="ln-btn ln-btn-primary w-full justify-center"
                disabled={loading.value}
              >
                {loading.value ? "Creating account..." : "Create account"}
              </button>
            </form>

            <p class="mt-4 text-[13px] text-subtle text-center">
              Already have an account?{" "}
              <Link href="/auth/login" class="text-accent hover:text-accent-hover">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
});
