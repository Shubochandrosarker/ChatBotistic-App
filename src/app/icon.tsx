import { ImageResponse } from "next/og";

// The browser-tab favicon: the Chatbotistic mark — brand-green tile,
// white speech bubble, green spark — matching the sidebar logo in
// `src/components/brand/logo.tsx`. Next renders this at build time and
// auto-injects <link rel="icon"> into <head>.
//
// The paths are redrawn inline rather than imported from the logo
// component because `next/og` renders through Satori, which resolves
// neither CSS variables nor Tailwind classes. At 32px the monoline
// bubble of the full mark would turn to mush, so this version fills the
// bubble solid and knocks the spark out of it in brand green — same
// silhouette, legible at a sixteenth of the size.

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Light-mode --primary from globals.css, resolved to sRGB.
const BRAND = "#008253";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${BRAND} 0%, #00a86c 100%)`,
          borderRadius: 7,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          {/* Speech bubble, filled so it holds up at 32px. */}
          <path
            d="M3.6 5.4A2.8 2.8 0 0 1 6.4 2.6h11.2a2.8 2.8 0 0 1 2.8 2.8v8.2a2.8 2.8 0 0 1-2.8 2.8H9.9l-3.6 3.1a.85.85 0 0 1-1.4-.65V5.4Z"
            fill="#ffffff"
          />
          {/* Spark knocked out of the bubble in brand green. */}
          <path
            d="M12 5.9l1.15 2.9a1 1 0 0 0 .56.56l2.9 1.15-2.9 1.15a1 1 0 0 0-.56.56L12 15.1l-1.15-2.88a1 1 0 0 0-.56-.56L7.39 10.5l2.9-1.15a1 1 0 0 0 .56-.56L12 5.9Z"
            fill={BRAND}
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
