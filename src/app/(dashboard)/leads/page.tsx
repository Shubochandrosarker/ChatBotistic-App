'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Mail,
  MessageSquareText,
  Phone,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import type { ChatbotisticLead } from '@/lib/chatbotistic/client'
import { Skeleton } from '@/components/dashboard/skeleton'

interface LeadsStats {
  total: number
  pagesScanned: number
  complete: boolean
  withPhone: number
  withEmail: number
  byAgent: { name: string; count: number }[]
}

interface LeadsResponse {
  configured: boolean
  leads?: ChatbotisticLead[]
  page?: number
  hasMore?: boolean
  fromDate?: string
  stats?: LeadsStats
  error?: string
}

function thirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
}

export default function LeadsPage() {
  const [fromDate, setFromDate] = useState(thirtyDaysAgo)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<LeadsResponse | null>(null)
  const [stats, setStats] = useState<LeadsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(
    async (nextPage: number, nextFromDate: string) => {
      setLoading(true)
      setError(null)
      try {
        // Stats reflect the whole date range, so they are only asked
        // for (and only computed) on the first page of a fresh load.
        const res = await fetch(
          `/api/leads?fromDate=${nextFromDate}&page=${nextPage}` +
            (nextPage === 1 ? '&includeStats=1' : ''),
        )
        const json: LeadsResponse = await res.json()
        if (!res.ok) {
          setError(json.error ?? 'Failed to load leads.')
          setData(null)
          setStats(null)
        } else {
          setData(json)
          if (json.stats) setStats(json.stats)
          if (nextPage === 1) setExpanded(new Set())
        }
      } catch {
        setError('Could not reach the server.')
        setData(null)
        setStats(null)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    load(page, fromDate)
  }, [load, page, fromDate])

  const leads = data?.leads ?? []

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-6 text-primary-foreground shadow-sm">
        <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Chatbot Leads</h1>
            <p className="mt-0.5 text-sm text-primary-foreground/80">
              Leads captured by your Chatbotistic bots, synced into the CRM.
            </p>
          </div>
        </div>
      </div>

      {/* Analytics */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label={`Leads since ${data?.fromDate ?? fromDate}`}
            value={String(stats.total)}
            hint={
              stats.complete
                ? `across ${stats.pagesScanned} page${stats.pagesScanned === 1 ? '' : 's'}`
                : `first ${stats.pagesScanned} pages — more may exist`
            }
          />
          <StatCard
            icon={<Phone className="h-4 w-4" />}
            label="With a phone number"
            value={String(stats.withPhone)}
            hint={stats.total ? `${Math.round((stats.withPhone / stats.total) * 100)}% of leads` : '—'}
          />
          <StatCard
            icon={<Mail className="h-4 w-4" />}
            label="With an email"
            value={String(stats.withEmail)}
            hint={stats.total ? `${Math.round((stats.withEmail / stats.total) * 100)}% of leads` : '—'}
          />
          <StatCard
            icon={<Bot className="h-4 w-4" />}
            label="Top capturing agent"
            value={stats.byAgent[0]?.name ?? '—'}
            hint={
              stats.byAgent[0]
                ? `${stats.byAgent[0].count} lead${stats.byAgent[0].count === 1 ? '' : 's'} · ${stats.byAgent.length} agent${stats.byAgent.length === 1 ? '' : 's'} total`
                : 'no agent data in range'
            }
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.06] shadow-sm">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted-foreground">From date</span>
          <input
            type="date"
            value={fromDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => {
              setPage(1)
              setFromDate(e.target.value)
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </label>
        <button
          type="button"
          onClick={() => load(page, fromDate)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Body */}
      <div className="rounded-2xl bg-card ring-1 ring-foreground/[0.06] shadow-sm">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            Leads {data?.fromDate ? `since ${data.fromDate}` : ''}
          </h2>
          {!loading && !error && data?.configured && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {leads.length} on page {data?.page ?? page}
            </span>
          )}
        </header>

        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <StateBlock
            title="Couldn't load leads"
            hint={error}
            tone="error"
          />
        ) : data && data.configured === false ? (
          <StateBlock
            title="Chatbotistic not connected"
            hint="Set CHATBOTISTIC_API_KEY in your environment variables, then restart the app to start syncing leads."
          />
        ) : leads.length === 0 ? (
          <StateBlock
            title="No leads in this range"
            hint="Try an earlier from-date, or wait for your chatbot to capture new leads."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Agent</th>
                    <th className="px-5 py-3 font-medium">Contact</th>
                    <th className="px-5 py-3 font-medium">Message</th>
                    <th className="px-5 py-3 font-medium">Source</th>
                    <th className="px-5 py-3 font-medium">Captured</th>
                    <th className="w-10 px-3 py-3" aria-label="Details" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leads.map((lead) => {
                    const isOpen = expanded.has(lead.id)
                    const hasDetails =
                      lead.fields.length > 0 || Boolean(lead.widget) || Boolean(lead.country)
                    return (
                      <Fragment key={lead.id}>
                        <tr
                          className={`transition-colors hover:bg-muted/50 ${isOpen ? 'bg-muted/40' : ''}`}
                        >
                          <td className="px-5 py-3 font-medium text-foreground">
                            {lead.name ?? '—'}
                          </td>
                          <td className="px-5 py-3">
                            {lead.agent ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                                <Bot className="h-3 w-3" />
                                {lead.agent}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-col gap-0.5 text-muted-foreground">
                              {lead.email && (
                                <span className="flex items-center gap-1.5">
                                  <Mail className="h-3.5 w-3.5" />
                                  {lead.email}
                                </span>
                              )}
                              {lead.phone && (
                                <span className="flex items-center gap-1.5">
                                  <Phone className="h-3.5 w-3.5" />
                                  {lead.phone}
                                </span>
                              )}
                              {!lead.email && !lead.phone && '—'}
                            </div>
                          </td>
                          <td className="max-w-xs px-5 py-3 text-muted-foreground">
                            <span className="line-clamp-2">
                              {lead.message ?? lead.landingUrl ?? '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {lead.source || lead.utm ? (
                              <span className="inline-flex max-w-[200px] items-center gap-1 truncate rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                                {lead.source ?? lead.utm}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-muted-foreground tabular-nums">
                            {formatDate(lead.createdAt)}
                          </td>
                          <td className="px-3 py-3">
                            {hasDetails && (
                              <button
                                type="button"
                                onClick={() => toggleRow(lead.id)}
                                aria-label={isOpen ? 'Hide details' : 'Show details'}
                                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                />
                              </button>
                            )}
                          </td>
                        </tr>
                        {isOpen && hasDetails && (
                          <tr className="bg-muted/30">
                            <td colSpan={7} className="px-5 py-4">
                              <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                  {lead.widget && (
                                    <DetailChip
                                      icon={<MessageSquareText className="h-3 w-3" />}
                                      label="Widget"
                                      value={lead.widget}
                                    />
                                  )}
                                  {lead.country && (
                                    <DetailChip label="Country" value={lead.country} />
                                  )}
                                  {lead.landingUrl && (
                                    <DetailChip label="Landing" value={lead.landingUrl} />
                                  )}
                                  {lead.utm && <DetailChip label="UTM" value={lead.utm} />}
                                </div>
                                {lead.fields.length > 0 && (
                                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {lead.fields.map((field, index) => (
                                      <div
                                        key={`${field.label}-${index}`}
                                        className="rounded-lg border border-border bg-background px-3 py-2"
                                      >
                                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                          {field.label}
                                        </p>
                                        <p className="mt-0.5 break-words text-sm text-foreground">
                                          {field.value}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <footer className="flex items-center justify-between border-t border-border px-5 py-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="text-xs text-muted-foreground tabular-nums">
                Page {data?.page ?? page}
              </span>
              <button
                type="button"
                disabled={!data?.hasMore}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/[0.06] shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <p className="truncate text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 truncate text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function DetailChip({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: string
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
      {icon}
      <span className="font-medium">{label}:</span>
      <span className="truncate text-foreground">{value}</span>
    </span>
  )
}

function StateBlock({
  title,
  hint,
  tone = 'neutral',
}: {
  title: string
  hint: string
  tone?: 'neutral' | 'error'
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      <div
        className={
          tone === 'error'
            ? 'flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive'
            : 'flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground'
        }
      >
        {tone === 'error' ? <Inbox className="h-5 w-5" /> : <Users className="h-5 w-5" />}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-md text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
