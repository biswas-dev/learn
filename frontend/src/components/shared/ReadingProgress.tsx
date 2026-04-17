import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";

interface Props {
  onComplete$?: () => void;
  isComplete?: boolean;
  threshold?: number;
}

export const ReadingProgress = component$<Props>(({ onComplete$, isComplete = false, threshold = 60 }) => {
  const progress = useSignal(isComplete ? 100 : 0);
  const fired = useSignal(isComplete);

  useVisibleTask$(({ cleanup }) => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        progress.value = 100;
        if (!fired.value) {
          fired.value = true;
          onComplete$?.();
        }
        return;
      }
      const pct = Math.min(100, (scrollTop / docHeight) * 100);
      progress.value = pct;

      if (pct >= threshold && !fired.value) {
        fired.value = true;
        onComplete$?.();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // initial check

    // Also fire on navigation away (clicking next/prev link)
    // This ensures completion is saved even if user clicks away mid-scroll
    const handleBeforeUnload = () => {
      if (progress.value >= threshold && !fired.value) {
        onComplete$?.();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    cleanup(() => {
      // Fire on cleanup (Qwik navigation) if threshold was reached
      if (progress.value >= threshold && !fired.value) {
        onComplete$?.();
      }
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    });
  });

  const size = 44;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress.value / 100) * circumference;
  const isComplete_ = progress.value >= 100;
  const color = isComplete_ ? "#34d399" : "#818cf8";

  return (
    <div class="fixed bottom-6 right-6 z-40 opacity-70 hover:opacity-100 transition-opacity">
      <svg width={size} height={size} class="transform -rotate-90 drop-shadow-lg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="#141621"
          stroke="#1e2235"
          stroke-width={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          stroke-width={stroke}
          stroke-linecap="round"
          stroke-dasharray={circumference}
          stroke-dashoffset={offset}
          class="transition-all duration-300"
        />
      </svg>
      {isComplete_ && (
        <svg
          class="absolute inset-0 m-auto"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#34d399"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
});
