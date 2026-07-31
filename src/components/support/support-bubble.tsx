"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Loader2, MessageCircleQuestion, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/logo";
import {
  SUPPORT_BUBBLE_ENABLED,
  SupportChatError,
  streamSupportReply,
  type SupportMessage,
} from "@/lib/support-chat";

// In-dashboard help bubble, backed by the WPISTIC AI worker.
//
// Built natively rather than as an <iframe> of chat.wpistic.cloud for
// three reasons: the worker sends `frame-ancestors 'none'`, so framing it
// is blocked outright until that changes; an iframe would drop WPISTIC AI
// branding and Stripe checkout into the middle of a product the viewer
// has already paid for; and it could not be styled to match. Owning the
// UI here costs one fetch client and gives us all three back.

const GREETING =
  "Hi — I can help with your Chatbotistic account, connecting WhatsApp, broadcasts, automations, and the API. What do you need?";

const SUGGESTIONS = [
  "How do I connect my WhatsApp number?",
  "Why is my broadcast not sending?",
  "How do automations get triggered?",
];

type Status = "idle" | "streaming" | "unavailable";

export function SupportBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const sessionId = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  // crypto.randomUUID is client-only, so this can't be a useState
  // initializer without diverging between server and client render.
  useEffect(() => {
    if (!sessionId.current) {
      sessionId.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now());
    }
  }, []);

  // Escape closes the panel and hands focus back to the launcher, so a
  // keyboard user is never stranded at the end of the document.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Pin to the newest message as tokens stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, status]);

  // Abandon an in-flight stream if the component goes away mid-reply.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || status === "streaming") return;

      const next: SupportMessage[] = [
        ...messages,
        { role: "user", content },
        { role: "assistant", content: "" },
      ];
      setMessages(next);
      setDraft("");
      setStatus("streaming");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // The trailing empty assistant turn is a UI placeholder, not part
        // of the conversation — send everything before it.
        await streamSupportReply(
          next.slice(0, -1),
          sessionId.current,
          (chunk) => {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") {
                copy[copy.length - 1] = {
                  ...last,
                  content: last.content + chunk,
                };
              }
              return copy;
            });
          },
          controller.signal,
        );
        setStatus("idle");
      } catch (err) {
        if (err instanceof SupportChatError && err.reason === "aborted") return;
        // Drop the empty placeholder and fall back to static help rather
        // than leaving a blank bubble sitting there.
        setMessages((prev) => prev.slice(0, -1));
        setStatus("unavailable");
      } finally {
        abortRef.current = null;
      }
    },
    [messages, status],
  );

  if (!SUPPORT_BUBBLE_ENABLED) return null;

  return (
    <>
      {/* Launcher */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? "Close help" : "Get help"}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex h-13 w-13 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground elevation-brand",
          "transition-transform duration-200 hover:scale-105 active:scale-95",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          open && "scale-95",
        )}
        style={{ height: 52, width: 52 }}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircleQuestion className="h-6 w-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Chatbotistic help"
          className={cn(
            "animate-rise fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card elevation-3",
            // Full-width sheet on phones, anchored card on tablets up.
            "inset-x-3 bottom-24 max-h-[min(560px,calc(100dvh-8rem))]",
            "sm:inset-x-auto sm:right-5 sm:w-[380px]",
          )}
        >
          <header className="brand-surface flex shrink-0 items-center gap-2.5 px-4 py-3.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-current/15">
              <BrandMark className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-sm font-bold">Chatbotistic help</p>
              <p className="text-xs text-current/70">
                Answers about your account and setup
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help"
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-current/15"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            <Bubble role="assistant">{GREETING}</Bubble>

            {messages.map((m, i) => (
              <Bubble key={i} role={m.role}>
                {m.content ||
                  (status === "streaming" && i === messages.length - 1 ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null)}
              </Bubble>
            ))}

            {messages.length === 0 && status !== "unavailable" && (
              <div className="flex flex-col gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-lg border border-border px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {status === "unavailable" && <UnavailableNotice />}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="flex shrink-0 items-end gap-2 border-t border-border p-3"
          >
            <label htmlFor="support-input" className="sr-only">
              Your question
            </label>
            <textarea
              id="support-input"
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter is a newline.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder="Ask about your account…"
              className="max-h-28 min-h-9 flex-1 resize-none rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:bg-card"
            />
            <button
              type="submit"
              disabled={!draft.trim() || status === "streaming"}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
            >
              {status === "streaming" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function Bubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap",
          role === "user"
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Shown when the worker can't be reached. The most likely cause by far is
 * that the dashboard origin isn't on the worker's CORS allowlist yet, so
 * this points at the things that always work instead of asking the user
 * to retry into the same wall.
 */
function UnavailableNotice() {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/10 p-3">
      <p className="text-[13px] font-medium text-foreground">
        The assistant is unreachable right now.
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Nothing is wrong with your account. In the meantime:
      </p>
      <div className="mt-2.5 flex flex-col gap-1.5">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 text-[13px] font-medium text-primary hover:underline"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Read the API docs
        </Link>
        <a
          href="https://chat.wpistic.cloud"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-[13px] font-medium text-primary hover:underline"
        >
          <MessageCircleQuestion className="h-3.5 w-3.5" />
          Open the assistant in a new tab
        </a>
      </div>
    </div>
  );
}
