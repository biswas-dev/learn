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
    <main class="max-w-md mx-auto px-4 py-20">
      <h1 class="text-2xl font-bold text-text mb-6">Log In</h1>

      {error.value && (
        <div class="mb-4 p-3 bg-failure/10 border border-failure/20 rounded-md text-sm text-failure">
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
        <label class="block mb-4">
          <span class="text-sm text-muted">Email</span>
          <input
            type="email"
            class="mt-1 block w-full bg-surface border border-border rounded-md px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
            value={email.value}
            onInput$={(_, el) => {
              email.value = el.value;
            }}
            required
          />
        </label>

        <label class="block mb-6">
          <span class="text-sm text-muted">Password</span>
          <input
            type="password"
            class="mt-1 block w-full bg-surface border border-border rounded-md px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
            value={password.value}
            onInput$={(_, el) => {
              password.value = el.value;
            }}
            required
          />
        </label>

        <button
          type="submit"
          class="w-full bg-accent text-white py-2 rounded-md text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
          disabled={loading.value}
        >
          {loading.value ? "Logging in..." : "Log In"}
        </button>
      </form>

      <p class="mt-4 text-sm text-muted text-center">
        Don't have an account?{" "}
        <Link href="/auth/signup" class="text-accent hover:text-accent-hover">
          Sign up
        </Link>
      </p>
    </main>
  );
});
