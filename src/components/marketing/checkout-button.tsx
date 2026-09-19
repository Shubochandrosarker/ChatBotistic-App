"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * In-page checkout: opens pay.wpistic.com in a modal iframe — the
 * buyer never leaves the site. Paddle's overlay renders inside the
 * iframe; on completion the iframe posts "wpistic-checkout-done"
 * up and we swap to a success state.
 */
const CHECKOUT_BASE = (
  process.env.NEXT_PUBLIC_WPISTIC_CHECKOUT_URL ?? "https://pay.wpistic.com"
).replace(/\/$/, "");

export function CheckoutButton({
  plan,
  cycle = "monthly",
  highlight,
  children,
}: {
  plan: string;
  cycle?: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === "wpistic-checkout-done") {
        setDone(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const openCheckout = useCallback(() => {
    setDone(false);
    setOpen(true);
    document.body.style.overflow = "hidden";
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    document.body.style.overflow = "";
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={openCheckout}
        className={cn(
          buttonVariants({ variant: highlight ? "default" : "outline" }),
          "w-full",
        )}
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="relative h-[85vh] max-h-[720px] w-full max-w-[460px] overflow-hidden rounded-2xl border bg-card shadow-2xl">
            <button
              type="button"
              onClick={close}
              aria-label="Close checkout"
              className="absolute right-3 top-3 z-10 rounded-full bg-black/5 p-1.5 text-muted-foreground hover:bg-black/10"
            >
              <X className="size-4" />
            </button>
            {done ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-green-100">
                  <Check className="size-7 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  Payment complete!
                </h3>
                <p className="text-sm text-muted-foreground">
                  Your subscription is being activated. Check your email —
                  license and dashboard access are on the way.
                </p>
                <a
                  href="/login?upgraded=1"
                  className="mt-2 text-sm font-medium text-primary hover:underline"
                >
                  Open the dashboard →
                </a>
              </div>
            ) : (
              <iframe
                src={`${CHECKOUT_BASE}/?plan=${plan}&cycle=${cycle}&embed=1`}
                className="h-full w-full border-0"
                title="Secure checkout — WPistic"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
