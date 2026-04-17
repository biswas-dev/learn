import { component$ } from "@builder.io/qwik";

interface Props {
  name: string;
  category?: string;
  size?: "sm" | "md";
}

const categoryColors: Record<string, string> = {
  "AI/ML": "bg-purple-500/15 text-purple-400",
  "System Design": "bg-blue-500/15 text-blue-400",
  "Web Frontend": "bg-cyan-500/15 text-cyan-400",
  "Web Backend": "bg-green-500/15 text-green-400",
  "DevOps/Cloud": "bg-orange-500/15 text-orange-400",
  "Languages": "bg-yellow-500/15 text-yellow-400",
  "Security": "bg-red-500/15 text-red-400",
  "Data/Analytics": "bg-teal-500/15 text-teal-400",
  "Databases": "bg-indigo-500/15 text-indigo-400",
  "Interviews": "bg-pink-500/15 text-pink-400",
  "Testing": "bg-lime-500/15 text-lime-400",
  "Mobile": "bg-fuchsia-500/15 text-fuchsia-400",
  "General": "bg-slate-500/15 text-slate-400",
};

export const TagBadge = component$<Props>(({ name, category, size = "sm" }) => {
  const colorClass = categoryColors[category || ""] || categoryColors["General"];
  const sizeClass = size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1";

  return (
    <span class={`${colorClass} ${sizeClass} rounded font-medium`}>
      {name}
    </span>
  );
});
