import { component$ } from "@builder.io/qwik";
import { useNavigate } from "@builder.io/qwik-city";

// Redirect /courses to /dashboard — dashboard is the main course browsing experience
export default component$(() => {
  const nav = useNavigate();
  nav("/dashboard");
  return <div class="p-10 text-muted">Redirecting...</div>;
});
