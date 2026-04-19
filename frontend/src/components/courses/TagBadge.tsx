import { component$ } from "@builder.io/qwik";

interface Props {
  name: string;
  category?: string;
  size?: "sm" | "md";
}

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  "AI/ML": { bg: "oklch(0.62 0.18 300 / 0.10)", text: "oklch(0.75 0.14 300)", border: "oklch(0.62 0.18 300 / 0.25)" },
  "System Design": { bg: "oklch(0.62 0.14 240 / 0.10)", text: "oklch(0.78 0.14 230)", border: "oklch(0.62 0.14 240 / 0.25)" },
  "Web Frontend": { bg: "oklch(0.68 0.13 215 / 0.10)", text: "oklch(0.78 0.12 215)", border: "oklch(0.68 0.13 215 / 0.25)" },
  "Web Backend": { bg: "oklch(0.84 0.16 150 / 0.10)", text: "oklch(0.84 0.16 150)", border: "oklch(0.84 0.16 150 / 0.25)" },
  "DevOps/Cloud": { bg: "oklch(0.75 0.15 55 / 0.10)", text: "oklch(0.82 0.14 55)", border: "oklch(0.75 0.15 55 / 0.25)" },
  "Languages": { bg: "oklch(0.82 0.16 80 / 0.10)", text: "oklch(0.82 0.16 80)", border: "oklch(0.82 0.16 80 / 0.25)" },
  "Security": { bg: "oklch(0.70 0.18 25 / 0.10)", text: "oklch(0.75 0.16 25)", border: "oklch(0.70 0.18 25 / 0.25)" },
  "Data/Analytics": { bg: "oklch(0.72 0.12 180 / 0.10)", text: "oklch(0.78 0.11 180)", border: "oklch(0.72 0.12 180 / 0.25)" },
  "Databases": { bg: "oklch(0.62 0.14 280 / 0.10)", text: "oklch(0.75 0.12 280)", border: "oklch(0.62 0.14 280 / 0.25)" },
  "Interviews": { bg: "oklch(0.70 0.14 340 / 0.10)", text: "oklch(0.78 0.12 340)", border: "oklch(0.70 0.14 340 / 0.25)" },
  "Testing": { bg: "oklch(0.80 0.18 130 / 0.10)", text: "oklch(0.82 0.16 130)", border: "oklch(0.80 0.18 130 / 0.25)" },
  "Mobile": { bg: "oklch(0.68 0.16 320 / 0.10)", text: "oklch(0.78 0.14 320)", border: "oklch(0.68 0.16 320 / 0.25)" },
  "General": { bg: "oklch(0.60 0.01 260 / 0.10)", text: "oklch(0.70 0.01 260)", border: "oklch(0.60 0.01 260 / 0.25)" },
};

export const TagBadge = component$<Props>(({ name, category, size = "sm" }) => {
  const colors = categoryColors[category || ""] || categoryColors["General"];
  const sizeClass = size === "sm"
    ? "text-[10.5px] px-[7px] py-[1px]"
    : "text-[12px] px-[9px] py-[2px]";

  return (
    <span
      class={`${sizeClass} rounded font-mono inline-flex items-center gap-[5px]`}
      style={{
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      <span
        class="w-[5px] h-[5px] rounded-full"
        style={{ background: colors.text }}
      />
      {name}
    </span>
  );
});
