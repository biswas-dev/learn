import { component$, Slot } from "@builder.io/qwik";
import { Sidebar } from "~/components/layout/Sidebar";

export default component$(() => {
  return (
    <div class="grid grid-cols-1 lg:grid-cols-[232px_1fr] min-h-[calc(100vh-57px)]">
      <Sidebar />
      <div class="min-w-0">
        <Slot />
      </div>
    </div>
  );
});
