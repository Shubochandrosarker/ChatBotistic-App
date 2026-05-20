import type { MetadataRoute } from "next";

// PWA manifest — makes the CRM installable as a standalone app with a
// proper name, theme color, and icon. Served at /manifest.webmanifest
// and auto-linked by Next.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WPistic WhatsApp CRM",
    short_name: "WPistic CRM",
    description:
      "Multi-tenant WhatsApp CRM — shared inbox, broadcasts, pipelines, and automations.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f6f5fb",
    theme_color: "#7c3aed",
    icons: [
      {
        src: "/icon",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
