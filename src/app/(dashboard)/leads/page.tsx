'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  Mail,
  Phone,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import type { ChatbotisticLead } from '@/lib/chatbotistic/client'
import { Skeleton } from '@/components/dashboard/skeleton'

interface LeadsResponse {
  configured: boolean
  leads?: ChatbotisticLead[]
  page?: number
  hasMore?: boolean
  fromDate?: string
  error?: string
}

function thirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
}

export default function LeadsPage() {
  const [fromDate, setFromDate] = useState(thirtyDaysAgo)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<LeadsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (nextPage: number, nextFromDate: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/leads?fromDate=${nextFromDate}&page=${nextPage}`,
        )
        const json: LeadsResponse = await res.json()
        if (!res.ok) {
          setError(json.error ?? 'Failed to load leads.')
          setData(null)
        } else {
          setData(json)
        }
      } catch {
        setError('Could not reach the server.')
        setData(null)
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
                    <th className="px-5 py-3 font-medium">Contact</th>
                    <th className="px-5 py-3 font-medium">Agent</th>
                    <th className="px-5 py-3 font-medium">Message</th>
                    <th className="px-5 py-3 font-medium">Source</th>
                    <th className="px-5 py-3 font-medium">Captured</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="transition-colors hover:bg-muted/50"
                    >
                      <td className="px-5 py-3 font-medium text-foreground">
                        {lead.name ?? '—'}
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
                      <td className="px-5 py-3 text-muted-foreground">
                        <div className="flex flex-col">
                          <span>{lead.agent ?? '—'}</span>
                          {lead.country && (
                            <span className="text-xs">{lead.country}</span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-xs px-5 py-3 text-muted-foreground">
                        <span className="line-clamp-2">
                          {lead.message ?? lead.landingUrl ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {lead.source || lead.utm ? (
                          <span className="inline-flex rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                            {lead.source ?? lead.utm}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground tabular-nums">
                        {formatDate(lead.createdAt)}
                      </td>
                    </tr>
                  ))}
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
        <Inbox className="h-5 w-5" />
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
