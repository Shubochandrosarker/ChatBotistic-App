import { Suspense } from 'react'
import { AlertTriangle } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import {
  loadActivity,
  loadConversationsSeries,
  loadMetrics,
  loadPipelineDonut,
  loadResponseTime,
} from '@/lib/dashboard/queries'
import type {
  ActivityItem,
  ConversationsSeriesPoint,
  MetricsBundle,
  PipelineDonutData,
  ResponseTimeSummary,
} from '@/lib/dashboard/types'

import { MetricsGrid } from '@/components/dashboard/metrics-grid'
import { ConversationsChartCard } from '@/components/dashboard/conversations-chart-card'
import { PipelineDonut } from '@/components/dashboard/pipeline-donut'
import { ResponseTimeChart } from '@/components/dashboard/response-time-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { SetupChecklist } from '@/components/dashboard/setup-checklist'
import { SkeletonCard } from '@/components/dashboard/skeleton'
import { Skeleton } from '@/components/ui/skeleton'

// Server Component. Each section below is its own async server
// component wrapped in <Suspense>, so the shell and hero paint
// immediately and every widget streams in independently as its
// query resolves — no client-side fetch waterfall.

// Per-user, cookie-scoped data — never statically prerendered.
export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <div className="space-y-5">
      {/* Hero header — static, paints instantly. */}
      <div className="animate-rise relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-6 text-primary-foreground elevation-2">
        <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-14 right-20 h-32 w-32 rounded-full bg-white/[0.07]" />
        <div className="relative">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-1 max-w-xl text-sm text-primary-foreground/80">
            Live analytics across conversations, contacts, deals, broadcasts,
            and automations.
          </p>
        </div>
      </div>

      {/* First-run setup — self-hides once complete or dismissed. */}
      <SetupChecklist />

      <Suspense fallback={<MetricsFallback />}>
        <MetricsSection />
      </Suspense>

      <QuickActions />

      <Suspense fallback={<ChartsFallback />}>
        <ChartsSection />
      </Suspense>

      <Suspense fallback={<PanelFallback height="h-48" />}>
        <ResponseTimeSection />
      </Suspense>

      <Suspense fallback={<PanelFallback height="h-64" />}>
        <ActivitySection />
      </Suspense>
    </div>
  )
}

// --- Streamed sections ------------------------------------------------

// Each section awaits its query inside try/catch and constructs JSX
// only afterwards — keeping rendering errors out of the catch (those
// belong to the route error boundary) while still degrading a single
// failed query to an inline notice instead of blanking the dashboard.

async function MetricsSection() {
  let metrics: MetricsBundle | null = null
  try {
    metrics = await loadMetrics(await createClient())
  } catch (err) {
    console.error('[dashboard] metrics failed:', err)
  }
  return metrics ? <MetricsGrid metrics={metrics} /> : <SectionError label="metrics" />
}

async function ChartsSection() {
  let data: [ConversationsSeriesPoint[], PipelineDonutData] | null = null
  try {
    const db = await createClient()
    data = await Promise.all([
      loadConversationsSeries(db, 30),
      loadPipelineDonut(db),
    ])
  } catch (err) {
    console.error('[dashboard] charts failed:', err)
  }
  if (!data) return <SectionError label="charts" />
  const [series, pipeline] = data
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="h-full lg:col-span-3">
        <ConversationsChartCard initial={series} />
      </div>
      <div className="h-full lg:col-span-2">
        <PipelineDonut data={pipeline} loading={false} />
      </div>
    </div>
  )
}

async function ResponseTimeSection() {
  let data: ResponseTimeSummary | null = null
  try {
    data = await loadResponseTime(await createClient())
  } catch (err) {
    console.error('[dashboard] response time failed:', err)
  }
  return data ? (
    <ResponseTimeChart data={data} loading={false} />
  ) : (
    <SectionError label="response times" />
  )
}

async function ActivitySection() {
  let items: ActivityItem[] | null = null
  try {
    items = await loadActivity(await createClient(), 50)
  } catch (err) {
    console.error('[dashboard] activity failed:', err)
  }
  return items ? (
    <ActivityFeed items={items} loading={false} />
  ) : (
    <SectionError label="activity" />
  )
}

// --- Fallbacks & errors -----------------------------------------------

function MetricsFallback() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

function ChartsFallback() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.06] elevation-1 lg:col-span-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-5 h-56 w-full" />
      </div>
      <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.06] elevation-1 lg:col-span-2">
        <Skeleton className="h-5 w-32" />
        <div className="mt-6 flex justify-center">
          <Skeleton className="h-40 w-40 rounded-full" />
        </div>
      </div>
    </div>
  )
}

function PanelFallback({ height }: { height: string }) {
  return (
    <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/[0.06] elevation-1">
      <Skeleton className="h-5 w-40" />
      <Skeleton className={`mt-5 w-full ${height}`} />
    </div>
  )
}

function SectionError({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 p-5 text-sm text-muted-foreground">
      <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
      <span>
        Couldn&apos;t load {label} right now. Refresh the page to try again.
      </span>
    </div>
  )
}
