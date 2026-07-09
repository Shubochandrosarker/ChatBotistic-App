import {
  BarChart3,
  CheckCheck,
  MessageCircle,
  Send,
  Workflow,
  Zap,
} from "lucide-react";

/**
 * Pure-CSS animated product mock for the hero: a shared-inbox
 * conversation that replays on a loop, with floating stat chips.
 * No client JS — every animation is a CSS keyframe.
 */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      {/* Backdrop glow */}
      <div className="mk-blob left-6 top-4 size-56 bg-primary/50" />
      <div
        className="mk-blob right-0 bottom-8 size-48 bg-[oklch(0.62_0.17_250)]/40"
        style={{ animationDelay: "2.5s" }}
      />

      {/* Inbox window */}
      <div className="elevation-3 relative overflow-hidden rounded-3xl border border-border bg-card">
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/12 text-primary">
              <MessageCircle className="size-4" />
            </span>
            <div>
              <p className="text-sm leading-tight font-semibold">Team Inbox</p>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="mk-live-dot inline-block size-1.5 rounded-full bg-success" />
                3 agents online
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-destructive/60" />
            <span className="size-2.5 rounded-full bg-warning/70" />
            <span className="size-2.5 rounded-full bg-success/70" />
          </div>
        </div>

        {/* Conversation */}
        <div className="mk-chat flex min-h-[360px] flex-col justify-end gap-2.5 bg-muted/40 p-4">
          <div className="max-w-[78%] self-start rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5 text-sm shadow-sm">
            Hi! Is the Growth plan still on sale? 👀
            <span className="mt-1 block text-[10px] text-muted-foreground">
              +1 555 · via WhatsApp
            </span>
          </div>

          <div className="max-w-[78%] self-end rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-sm">
            Hey Maya! Yes — 20% off until Friday. Want the checkout link?
            <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-primary-foreground/80">
              Sofia · just now <CheckCheck className="size-3" />
            </span>
          </div>

          <div className="max-w-[78%] self-start rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5 text-sm shadow-sm">
            Yes please! 🙌
          </div>

          <div className="flex items-center gap-2 self-end rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary">
            <Workflow className="size-3.5" />
            Automation: checkout link sent + deal moved to “Won”
          </div>

          <div className="flex max-w-[50%] items-center gap-2 self-start rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-3 text-muted-foreground shadow-sm">
            <span className="mk-typing flex items-center gap-1">
              <span />
              <span />
              <span />
            </span>
          </div>
        </div>

        {/* Composer */}
        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <div className="h-9 flex-1 rounded-full border border-border bg-muted/60 px-4 text-sm leading-9 text-muted-foreground">
            Reply as your team…
          </div>
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Send className="size-4" />
          </span>
        </div>
      </div>

      {/* Floating chips */}
      <div className="mk-float elevation-2 absolute -left-6 top-[4.7rem] hidden items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-2.5 sm:flex">
        <span className="flex size-8 items-center justify-center rounded-xl bg-success/12 text-success">
          <BarChart3 className="size-4" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">Broadcast delivered</p>
          <p className="text-sm font-semibold">1,284 / 1,300</p>
        </div>
      </div>

      <div className="mk-float-delay elevation-2 absolute -right-3 bottom-24 hidden items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-2.5 sm:flex">
        <span className="flex size-8 items-center justify-center rounded-xl bg-warning/15 text-warning">
          <Zap className="size-4" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">Automations today</p>
          <p className="text-sm font-semibold">47 runs</p>
        </div>
      </div>
    </div>
  );
}
