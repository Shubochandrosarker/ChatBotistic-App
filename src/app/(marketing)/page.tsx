import { redirect } from "next/navigation";

export default function AppEntry() {
  // The public product story lives at www.chatbotistic.com. This hostname is
  // intentionally the authenticated dashboard entry point, so customers never
  // mistake the operational app for the marketing site.
  redirect("/login");
}
