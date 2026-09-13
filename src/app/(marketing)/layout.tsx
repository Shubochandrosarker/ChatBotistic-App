import type { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import "./marketing.css";

// The public product story lives on www.chatbotistic.com. Keep the app host
// operational and noindex so search engines do not split signals between the
// marketing site and the authenticated product.
export const metadata: Metadata = {
  metadataBase: new URL("https://app.chatbotistic.com"),
  alternates: { canonical: "https://www.chatbotistic.com/" },
  openGraph: {
    type: "website",
    siteName: "Chatbotistic",
    title: "Chatbotistic — WhatsApp CRM and automation workspace",
    description: "Bring your customer conversations, team inbox, chatbot widgets, and follow-up automations into one workspace.",
    url: "https://app.chatbotistic.com/",
  },
  robots: { index: false, follow: true },
  description:
    "Chatbotistic — shared team inbox, broadcast campaigns, sales pipelines, chatbot widgets, and visual automations on Meta Cloud API, Twilio, or your own SMS gateway.",
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
