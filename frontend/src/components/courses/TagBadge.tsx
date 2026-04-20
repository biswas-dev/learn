import { component$ } from "@builder.io/qwik";

interface Props {
  name: string;
  category?: string;
  size?: "sm" | "md";
}

export const TagBadge = component$<Props>(({ name, size = "sm" }) => {
  const sizeClass = size === "sm"
    ? "text-[10.5px] px-[7px] py-[1px]"
    : "text-[12px] px-[9px] py-[2px]";

  return (
    <span class={`ln-tag ${sizeClass}`}>
      {name}
    </span>
  );
});
