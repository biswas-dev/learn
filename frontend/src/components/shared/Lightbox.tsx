import { component$, useSignal, useVisibleTask$, type Signal } from "@builder.io/qwik";

interface Props {
  src: Signal<string>;
  alt: Signal<string>;
}

export const Lightbox = component$<Props>(({ src, alt }) => {
  if (!src.value) return null;

  return (
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
      onClick$={() => {
        src.value = "";
      }}
    >
      <button
        class="absolute top-4 right-4 text-white/80 hover:text-white text-3xl font-light z-[101]"
        onClick$={() => {
          src.value = "";
        }}
      >
        &times;
      </button>
      {alt.value && (
        <p class="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-sm max-w-lg text-center">
          {alt.value}
        </p>
      )}
      <img
        src={src.value}
        alt={alt.value}
        class="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        onClick$={(e) => e.stopPropagation()}
        width={900}
        height={600}
      />
    </div>
  );
});

/**
 * Hook that attaches click handlers to all images inside a content container.
 * Call this in the page component and pass the lightbox signals.
 */
export function useImageLightbox(
  lightboxSrc: Signal<string>,
  lightboxAlt: Signal<string>,
) {
  useVisibleTask$(({ track, cleanup }) => {
    track(() => lightboxSrc.value);

    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG") {
        const img = target as HTMLImageElement;
        lightboxSrc.value = img.src;
        lightboxAlt.value = img.alt || "";
        e.preventDefault();
      }
    };

    const container = document.querySelector(".ln-prose");
    if (container) {
      container.addEventListener("click", handler);
      // Make images look clickable
      container.querySelectorAll("img").forEach((img) => {
        (img as HTMLElement).style.cursor = "zoom-in";
      });
      cleanup(() => container.removeEventListener("click", handler));
    }
  });
}
