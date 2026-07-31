import { cn } from "@/lib/utils";

// The Chatbotistic mark, drawn in code rather than shipped as an asset
// so it stays crisp at every size, recolors with the theme, and costs
// no extra request. The glyph is a monoline speech bubble with a
// four-point spark inside it — conversation plus AI, in one shape.
//
// Consumers:
//   <BrandMark />  — the bare glyph, inherits `currentColor`
//   <BrandTile />  — the glyph on the brand-filled rounded tile
//   <BrandLogo />  — tile + "Chatbotistic" wordmark (sidebar, auth)
//
// The favicon and PWA icon in `src/app/icon.tsx` redraw the same paths
// inline, because `next/og` renders in a separate Satori pass that
// cannot import React components that rely on CSS variables.

/** Path data shared with `src/app/icon.tsx` — keep the two in sync. */
export const BUBBLE_PATH =
  "M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H9.7L5.4 19.6A.8.8 0 0 1 4 19V5.5Z";
export const SPARK_PATH =
  "M12 6.4l1.05 2.65a1 1 0 0 0 .56.56L16.26 10.7l-2.65 1.05a1 1 0 0 0-.56.56L12 14.96l-1.05-2.65a1 1 0 0 0-.56-.56L7.74 10.7l2.65-1.05a1 1 0 0 0 .56-.56L12 6.4Z";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("h-[18px] w-[18px]", className)}
    >
      <path
        d={BUBBLE_PATH}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d={SPARK_PATH} fill="currentColor" />
    </svg>
  );
}

/**
 * The mark on its brand tile — the app's primary identity object.
 *
 * Uses `bg-primary` rather than the `.brand-surface` panel treatment.
 * At 36px this is a button-scale fill, which is exactly what the dark
 * theme's bright mint primary is tuned for; the deep forest green that
 * `.brand-surface` uses for half-screen panels would go muddy against
 * the obsidian sidebar at this size.
 */
export function BrandTile({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
        "bg-primary text-primary-foreground elevation-brand",
        className,
      )}
    >
      <BrandMark />
    </span>
  );
}

interface BrandLogoProps {
  className?: string;
  /** Hide the wordmark and show the tile alone (collapsed rails, mobile). */
  markOnly?: boolean;
}

export function BrandLogo({ className, markOnly = false }: BrandLogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandTile />
      {!markOnly && (
        <span className="brand-text font-heading text-[17px] font-extrabold tracking-[-0.02em]">
          Chatbotistic
        </span>
      )}
    </span>
  );
}
