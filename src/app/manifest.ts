import type { MetadataRoute } from "next";

// PWA manifest — makes Chatbotistic installable as a standalone app
// with a proper name, theme color, and icon. Served at
// /manifest.webmanifest and auto-linked by Next.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chatbotistic",
    short_name: "Chatbotistic",
    description:
      "Every conversation, contact, and deal in one place — shared inbox, broadcasts, pipelines, and automations.",
    start_url: "/dashboard",
    display: "standalone",
    // Matches the light-mode --background and --primary tokens in
    // globals.css, so the splash screen matches the app it opens into.
    background_color: "#f5faf7",
    theme_color: "#008253",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
