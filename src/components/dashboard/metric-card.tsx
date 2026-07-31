"use client"

import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { useCountUp } from '@/hooks/use-count-up'

/**
 * Accent palette for the icon chip. These map onto the chart series
 * tokens rather than raw Tailwind palette colors, so the KPI row, the
 * line chart, and the pipeline donut all speak the same categorical
 * language — and every one of them re-tints correctly in dark mode
 * instead of needing a hardcoded `dark:` override per shade.
 */
export type MetricAccent = 'brand' | 'sky' | 'violet' | 'amber'

const ACCENT: Record<MetricAccent, string> = {
  brand: 'bg-chart-1/12 text-chart-1',
  sky: 'bg-chart-2/12 text-chart-2',
  violet: 'bg-chart-3/12 text-chart-3',
  amber: 'bg-chart-4/14 text-chart-4',
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
  accent = 'brand',
  delta,
  subtitle,
}: MetricCardProps) {
  const animated = useCountUp(value)

  return (
    <div className="surface-lit group rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.06] elevation-1 transition-shadow hover:elevation-2">
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
      <p className="font-heading mt-4 text-[30px] leading-none font-extrabold tabular-nums tracking-tight text-foreground">
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
      ? 'text-success'
      : sign < 0
        ? 'text-destructive'
        : 'text-muted-foreground'
  const Arrow = sign > 0 ? ArrowUp : sign < 0 ? ArrowDown : Minus
  return (
    <div className={cn('mt-2.5 flex items-center gap-1 text-sm font-medium', tone)}>
      <Arrow className="h-4 w-4" aria-hidden />
      <span className="tabular-nums">{label}</span>
    </div>
  )
}
