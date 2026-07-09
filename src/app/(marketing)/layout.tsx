import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import "./marketing.css";

// The app shell is noindex (see the root layout); the public marketing
// and docs pages are the one part of the product that should be crawled.
export const metadata: Metadata = {
  robots: { index: true, follow: true },
  description:
    "WPistic WhatsApp CRM — shared team inbox, broadcast campaigns, sales pipelines, and visual automations on Meta Cloud API, Twilio, or your own SMS gateway.",
};

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
