import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

// Re-exported so existing dashboard widgets keep importing `Skeleton`
// from here while the canonical primitive lives in `ui/skeleton`.
export { Skeleton }

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.06] shadow-sm',
        className,
      )}
    >
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-8 w-20" />
      <Skeleton className="mt-2 h-3 w-16" />
    </div>
  )
}
