import { component$, Slot } from "@builder.io/qwik";
import { Sidebar } from "~/components/layout/Sidebar";

export default component$(() => {
  return (
    <div class="flex">
      <Sidebar />
      <div class="flex-1 min-w-0">
        <Slot />
      </div>
    </div>
  );
});
