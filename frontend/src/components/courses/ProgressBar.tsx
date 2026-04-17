import { component$ } from "@builder.io/qwik";

interface Props {
  percent: number;
  height?: string;
  showLabel?: boolean;
}

export const ProgressBar = component$<Props>(({ percent, height = "h-1.5", showLabel = false }) => {
  const clamped = Math.min(100, Math.max(0, percent));
  const color = clamped >= 100 ? "bg-success" : "bg-accent";

  return (
    <div class="flex items-center gap-2">
      <div class={`flex-1 rounded-full bg-border overflow-hidden ${height}`}>
        <div
          class={`${color} ${height} rounded-full transition-all duration-500`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span class="text-xs text-muted whitespace-nowrap">{Math.round(clamped)}%</span>
      )}
    </div>
  );
});
