import { component$ } from "@builder.io/qwik";

interface Props {
  percent: number;
  height?: string;
  showLabel?: boolean;
}

export const ProgressBar = component$<Props>(({ percent, height = "h-1", showLabel = false }) => {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div class="flex items-center gap-2">
      <div class={`flex-1 ln-track ${height}`}>
        <div
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span class="font-mono text-[10.5px] text-subtle whitespace-nowrap">{Math.round(clamped)}%</span>
      )}
    </div>
  );
});
