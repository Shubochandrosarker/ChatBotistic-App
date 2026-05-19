import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level skeletons. Each one mirrors the real layout of its page
 * so navigation paints an instant, shape-correct placeholder instead
 * of a blank flash or a bare spinner.
 */

const CARD = "rounded-2xl bg-card ring-1 ring-foreground/[0.06] shadow-sm";

/** Page title + subtitle, with an optional trailing action button. */
function PageHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      {action && <Skeleton className="h-9 w-32 rounded-lg" />}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      {/* Hero */}
      <Skeleton className="h-28 rounded-2xl" />

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn(CARD, "p-5")}>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-8 w-20" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className={cn(CARD, "p-5 lg:col-span-3")}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-5 h-56 w-full" />
        </div>
        <div className={cn(CARD, "p-5 lg:col-span-2")}>
          <Skeleton className="h-5 w-32" />
          <div className="mt-6 flex justify-center">
            <Skeleton className="h-40 w-40 rounded-full" />
          </div>
        </div>
      </div>

      <div className={cn(CARD, "p-5")}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-5 h-32 w-full" />
      </div>

      <div className={cn(CARD, "p-5")}>
        <Skeleton className="h-5 w-36" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InboxSkeleton() {
  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Conversation list */}
      <div className={cn(CARD, "hidden w-80 shrink-0 flex-col p-3 sm:flex")}>
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="mt-3 space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg p-2.5">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className={cn(CARD, "flex flex-1 flex-col p-4")}>
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-3 py-4">
          {[
            "mr-auto w-3/5",
            "ml-auto w-2/5",
            "mr-auto w-1/2",
            "ml-auto w-3/5",
            "mr-auto w-2/5",
          ].map((side, i) => (
            <Skeleton key={i} className={cn("h-12 rounded-2xl", side)} />
          ))}
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function ContactsSkeleton() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <div className={cn(CARD, "overflow-hidden")}>
        <div className="border-b border-border p-4">
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border p-4 last:border-0"
          >
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PipelinesSkeleton() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="w-72 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            {Array.from({ length: 3 }).map((_, card) => (
              <div key={card} className={cn(CARD, "space-y-3 p-4")}>
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-7 w-7 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BroadcastsSkeleton() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={cn(CARD, "space-y-3 p-5")}>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex gap-4 pt-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Generic list page — used by Automations, Leads, Knowledge Base. */
export function ListPageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <div className={cn(CARD, "overflow-hidden")}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border p-4 last:border-0"
          >
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton action={false} />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-lg" />
        ))}
      </div>
      <div className={cn(CARD, "max-w-2xl space-y-5 p-6")}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Full app-shell skeleton — sidebar + header + content. Shown during
 * the auth gate so the first paint matches the final layout exactly
 * and there's no spinner-to-app jump.
 */
export function AppShellSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex flex-col gap-1 px-3 py-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
        <div className="mt-auto border-t border-sidebar-border p-3">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4 lg:px-6">
          <Skeleton className="h-5 w-32" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <DashboardSkeleton />
        </main>
      </div>
    </div>
  );
}
