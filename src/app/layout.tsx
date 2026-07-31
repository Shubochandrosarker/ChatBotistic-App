import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { AppToaster } from "@/components/app-toaster";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";
import "./globals.css";

// Brand typography, self-hosted by next/font so there is no external
// request at runtime and no layout shift.
//
// Inter carries the interface, Plus Jakarta Sans carries headings (it
// is geometric and a little wider, which is what gives headings their
// presence next to Inter's neutral body text), and JetBrains Mono
// carries code — API keys, embed snippets, webhook URLs.
//
// Each exposes a CSS variable that `globals.css` composes into
// --font-sans / --font-display / --font-mono-stack with system
// fallbacks appended.
const brandSans = Inter({
  subsets: ["latin"],
  variable: "--font-brand-sans",
  display: "swap",
});

const brandDisplay = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-brand-display",
  display: "swap",
});

const brandMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-brand-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Chatbotistic",
    template: "%s — Chatbotistic",
  },
  description:
    "Every conversation, contact, and deal in one place — shared inbox, broadcasts, pipelines, and automations.",
  applicationName: "Chatbotistic",
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
  // Matches the light --background and the dark --background tokens in
  // globals.css, so the browser chrome blends into the app canvas.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5faf7" },
    { media: "(prefers-color-scheme: dark)", color: "#050c09" },
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
      className={`h-full antialiased ${brandSans.variable} ${brandDisplay.variable} ${brandMono.variable}`}
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
