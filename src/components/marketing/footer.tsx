import Link from "next/link";
import { MessageCircle } from "lucide-react";

const columns: { heading: string; links: { href: string; label: string }[] }[] =
  [
    {
      heading: "Product",
      links: [
        { href: "/#features", label: "Features" },
        { href: "/#how-it-works", label: "How it works" },
        { href: "/#integrations", label: "Integrations" },
        { href: "/signup", label: "Get started" },
      ],
    },
    {
      heading: "Developers",
      links: [
        { href: "/docs", label: "API documentation" },
        { href: "/docs#webhooks", label: "Webhooks" },
        { href: "/docs#sso", label: "SSO" },
        { href: "/docs#environment", label: "Self-hosting" },
      ],
    },
    {
      heading: "Account",
      links: [
        { href: "/login", label: "Sign in" },
        { href: "/signup", label: "Create account" },
        { href: "/forgot-password", label: "Reset password" },
      ],
    },
  ];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Link
            href="/"
            className="flex items-center gap-2.5 font-semibold tracking-tight"
          >
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <MessageCircle className="size-4.5" />
            </span>
            <span>
              WPistic <span className="text-primary">WhatsApp CRM</span>
            </span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            The multi-tenant WhatsApp CRM — shared inbox, broadcasts,
            pipelines, and automations on Meta Cloud API, Twilio, or your own
            SMS gateway.
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.heading}>
            <h3 className="text-sm font-semibold">{col.heading}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>
            © {new Date().getFullYear()} WPistic. Part of the WordPressistic
            ecosystem.
          </p>
          <p>
            Built on Next.js + Supabase · Meta Cloud API · Twilio · Jasmin SMS
          </p>
        </div>
      </div>
    </footer>
  );
}
