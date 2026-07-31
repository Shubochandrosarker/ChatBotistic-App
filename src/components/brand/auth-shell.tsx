import type { ReactNode } from "react";
import { BrandLogo, BrandMark } from "@/components/brand/logo";

// Shared frame for login / signup / forgot-password.
//
// Two columns on lg+: a brand panel that states what the product does,
// and the form. Below lg the panel drops out entirely — on a phone it
// would push the form below the fold, and the whole job of this screen
// is to get someone into the app. The wordmark reappears above the form
// at that size so the page is still identifiably Chatbotistic.

const POINTS = [
  "One WhatsApp number, your whole team.",
  "Broadcasts with delivery and read tracking.",
  "Automations that reply, tag, and follow up on their own.",
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel — lg and up. */}
      <aside className="brand-surface relative hidden w-[46%] max-w-2xl flex-col justify-between overflow-hidden p-10 lg:flex xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full border border-current/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-current/10 blur-3xl"
        />

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-current/15">
            <BrandMark />
          </span>
          <span className="font-heading text-[17px] font-extrabold tracking-[-0.02em]">
            Chatbotistic
          </span>
        </div>

        <div className="relative">
          <h2 className="font-heading max-w-md text-[32px] leading-[1.15] font-extrabold tracking-tight xl:text-[38px]">
            Every conversation in one place.
          </h2>
          <ul className="mt-7 flex flex-col gap-3.5">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-[15px]">
                <span
                  aria-hidden
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-current/60"
                />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-current/60">
          Part of the WordPressistic family.
        </p>
      </aside>

      {/* Form column. */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-7 flex justify-center lg:hidden">
            <BrandLogo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
