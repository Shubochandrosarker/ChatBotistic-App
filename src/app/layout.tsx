import type { Metadata, Viewport } from "next";
<<<<<<< HEAD
import { Inter, Sora } from "next/font/google";
=======
>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)
import { AppToaster } from "@/components/app-toaster";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";
import "./globals.css";

<<<<<<< HEAD
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Dedicated display face for headings — gives titles their own
// character instead of reusing the body sans.
const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

=======
>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)
export const metadata: Metadata = {
  title: {
    default: "WPistic WhatsApp CRM",
    template: "%s — WPistic WhatsApp CRM",
  },
  description: "Multi-tenant WhatsApp CRM — shared inbox, broadcasts, pipelines, and automations.",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [{ url: "/icon" }],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c2e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
<<<<<<< HEAD
      className={`${inter.variable} ${sora.variable} h-full antialiased`}
=======
      className="h-full antialiased"
>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground">
        <ThemeProvider>
          {children}
          <AppToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
