import { component$, Slot } from "@builder.io/qwik";

export default component$(() => {
  return (
    <div class="min-h-[calc(100vh-57px)]">
      <Slot />
    </div>
  );
});
