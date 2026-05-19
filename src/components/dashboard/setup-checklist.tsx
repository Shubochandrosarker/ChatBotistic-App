"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  MessageCircle,
  Users,
  Radio,
  Zap,
  X,
  Rocket,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "wpistic-onboarding-dismissed";

interface Step {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  done: boolean;
}

/**
 * First-run setup checklist. Surfaces the four steps a new org needs to
 * get value from the CRM, with live progress. Hides itself once every
 * step is complete (or when the user dismisses it) so established orgs
 * never see it again.
 */
export function SetupChecklist() {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // localStorage is client-only, so this is a post-mount sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");

    const db = createClient();
    const countOf = async (table: string) => {
      const { count } = await db
        .from(table)
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    };

    void Promise.all([
      countOf("whatsapp_config"),
      countOf("contacts"),
      countOf("broadcasts"),
      countOf("automations"),
    ])
      .then(([whatsapp, contacts, broadcasts, automations]) => {
        setSteps([
          {
            id: "whatsapp",
            label: "Connect WhatsApp",
            description: "Link your Meta or Twilio number to start messaging.",
            href: "/settings?tab=whatsapp",
            icon: MessageCircle,
            done: whatsapp > 0,
          },
          {
            id: "contacts",
            label: "Import contacts",
            description: "Bring in your audience from a CSV or add them by hand.",
            href: "/contacts",
            icon: Users,
            done: contacts > 0,
          },
          {
            id: "broadcast",
            label: "Send your first broadcast",
            description: "Reach your contacts with an approved template.",
            href: "/broadcasts/new",
            icon: Radio,
            done: broadcasts > 0,
          },
          {
            id: "automation",
            label: "Build an automation",
            description: "Let replies, tags, and follow-ups run themselves.",
            href: "/automations/new",
            icon: Zap,
            done: automations > 0,
          },
        ]);
      })
      .catch((err) => {
        console.error("[setup-checklist] load failed:", err);
      });
  }, []);

  const dismiss = useCallback(() => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }, []);

  if (dismissed || !steps) return null;

  const completed = steps.filter((s) => s.done).length;
  // Nothing left to do — get out of the way permanently.
  if (completed === steps.length) return null;

  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="animate-rise overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.06] elevation-1">
      <div className="flex items-start justify-between gap-4 border-b border-border p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">
              Finish setting up your CRM
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {completed} of {steps.length} steps done — you&apos;re {pct}%
              there.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss setup checklist"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full bg-muted">
        <div
          className="h-full rounded-r-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="divide-y divide-border">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.id}>
              <Link
                href={step.href}
                className={cn(
                  "flex items-center gap-3.5 p-4 transition-colors hover:bg-muted/50",
                  step.done && "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    step.done
                      ? "bg-success/15 text-success"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {step.done ? (
                    <Check className="h-4.5 w-4.5" />
                  ) : (
                    <Icon className="h-4.5 w-4.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm font-medium text-foreground",
                      step.done && "line-through",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {step.description}
                  </span>
                </span>
                {!step.done && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
