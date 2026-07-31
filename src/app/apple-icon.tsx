import { ImageResponse } from "next/og";

// The home-screen icon for iOS and the large PWA install icon. Same
// mark as `icon.tsx`, drawn at 180px where the monoline bubble has room
// to breathe, so this one keeps the stroked treatment of the real logo
// instead of the filled small-size variant.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const BRAND = "#008253";

export default function AppleIcon() {
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
        }}
      >
        <svg width="112" height="112" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H9.7L5.4 19.6A.8.8 0 0 1 4 19V5.5Z"
            stroke="#ffffff"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M12 6.4l1.05 2.65a1 1 0 0 0 .56.56l2.65 1.05-2.65 1.05a1 1 0 0 0-.56.56L12 14.96l-1.05-2.65a1 1 0 0 0-.56-.56L7.74 10.66l2.65-1.05a1 1 0 0 0 .56-.56L12 6.4Z"
            fill="#ffffff"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
