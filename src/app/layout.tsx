import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppToaster } from "@/components/app-toaster";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

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
      className={`${inter.variable} h-full antialiased`}
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
