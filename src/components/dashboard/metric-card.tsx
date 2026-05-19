"use client"

import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { useCountUp } from '@/hooks/use-count-up'

/** Accent palette for the icon chip — categorical, theme-stable. */
export type MetricAccent = 'violet' | 'blue' | 'emerald' | 'amber'

const ACCENT: Record<MetricAccent, string> = {
  violet: 'bg-violet-500/12 text-violet-500 dark:text-violet-300',
  blue: 'bg-blue-500/12 text-blue-500 dark:text-blue-300',
  emerald: 'bg-emerald-500/12 text-emerald-500 dark:text-emerald-300',
  amber: 'bg-amber-500/14 text-amber-600 dark:text-amber-300',
}

interface MetricCardProps {
  title: string
  /** Raw numeric value — animated via count-up on mount and on change. */
  value: number
  /** Formats the (rounded) value for display. Defaults to a locale int. */
  format?: (n: number) => string
  icon: ComponentType<{ className?: string }>
  accent?: MetricAccent
  /**
   * Delta-mode secondary row: arrow + delta text. Omit when the metric
   * doesn't have a sensible comparison (e.g. total pipeline value).
   */
  delta?: {
    /** Positive / negative / zero drives arrow + color. */
    sign: number
    /** Pre-formatted delta, e.g. "+3 vs yesterday". */
    label: string
  }
  /** Used instead of `delta` when the metric has a static subtitle. */
  subtitle?: string
}

const defaultFormat = (n: number) => Math.round(n).toLocaleString()

export function MetricCard({
  title,
  value,
  format = defaultFormat,
  icon: Icon,
  accent = 'violet',
  delta,
  subtitle,
}: MetricCardProps) {
  const animated = useCountUp(value)

  return (
    <div className="group rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.06] elevation-1 transition-shadow hover:elevation-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105',
            ACCENT[accent],
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
      </div>
      <p className="mt-4 text-[30px] leading-none font-bold tabular-nums text-foreground">
        {format(animated)}
      </p>
      {delta ? (
        <DeltaRow sign={delta.sign} label={delta.label} />
      ) : subtitle ? (
        <p className="mt-2.5 text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  )
}

function DeltaRow({ sign, label }: { sign: number; label: string }) {
  const tone =
    sign > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : sign < 0
        ? 'text-rose-500 dark:text-rose-400'
        : 'text-muted-foreground'
  const Arrow = sign > 0 ? ArrowUp : sign < 0 ? ArrowDown : Minus
  return (
    <div className={cn('mt-2.5 flex items-center gap-1 text-sm font-medium', tone)}>
      <Arrow className="h-4 w-4" aria-hidden />
      <span className="tabular-nums">{label}</span>
    </div>
  )
}
