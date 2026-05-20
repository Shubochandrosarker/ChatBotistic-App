import Link from 'next/link'
import { BarChart3 } from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * Shared empty-state panel. Used both for charts that lack enough data
 * and for list/board pages with no records yet. Pass an `action` to
 * turn it into a designed first-run prompt with a primary CTA.
 */
export function EmptyState({
  title = 'Not enough data yet',
  hint,
  icon: Icon = BarChart3,
  action,
  className,
}: {
  title?: string
  hint?: string
  icon?: ComponentType<{ className?: string }>
  /** Optional primary CTA — renders a button linking somewhere useful. */
  action?: { label: string; href: string }
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/40 px-4 py-10 text-center',
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>}
      {action && (
        <Button render={<Link href={action.href} />} size="sm" className="mt-3">
          {action.label}
        </Button>
      )}
    </div>
  )
}
