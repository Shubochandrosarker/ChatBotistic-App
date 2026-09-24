import { NextResponse } from 'next/server'
import { requireOrgId } from '@/lib/api/require-org-id'
import { orgLeadsApiKey } from '@/lib/tochat/org-config'
import {
  ChatbotisticError,
  fetchLeads,
  isChatbotisticConfigured,
  type ChatbotisticLead,
} from '@/lib/chatbotistic/client'

/** Upper bound on pages pulled per stats scan (5 × 20 = 100 leads). */
const STATS_MAX_PAGES = 5

export interface LeadsStats {
  /** Leads seen across the scanned pages. */
  total: number
  pagesScanned: number
  /** False when the scan hit STATS_MAX_PAGES and more data may exist. */
  complete: boolean
  withPhone: number
  withEmail: number
  /** Agents (or sources) ranked by captured leads, top 5. */
  byAgent: { name: string; count: number }[]
}

function computeStats(leads: ChatbotisticLead[], pagesScanned: number, complete: boolean): LeadsStats {
  const counts = new Map<string, number>()
  let withPhone = 0
  let withEmail = 0
  for (const lead of leads) {
    const agent = lead.agent ?? lead.widget ?? lead.source ?? 'Unknown'
    counts.set(agent, (counts.get(agent) ?? 0) + 1)
    if (lead.phone) withPhone += 1
    if (lead.email) withEmail += 1
  }
  const byAgent = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5)
  return { total: leads.length, pagesScanned, complete, withPhone, withEmail, byAgent }
}

/**
 * GET /api/leads?fromDate=YYYY-MM-DD&page=N&includeStats=1
 *
 * Auth-gated, org-scoped proxy to the white-label leads API. When the
 * org has saved its own leads API key (Settings → Chatbotistic), that
 * key is used — the org sees only leads captured by its own widgets.
 * Otherwise the deployment-wide CHATBOTISTIC_API_KEY applies (shared
 * master-account leads). The key stays server-side; the browser only
 * ever talks to this route.
 *
 * includeStats=1 (only honoured on page 1) additionally scans up to
 * STATS_MAX_PAGES of the range server-side and returns a `stats`
 * summary: totals, contactability, and a per-agent breakdown.
 *
 * Response shape:
 *   { configured: false }                          — integration not set up
 *   { configured: true, leads: [...], page, hasMore, stats? }
 *   { error: '...' }                               — on failure
 */
export async function GET(request: Request) {
  try {
    const { orgId, supabase, error: orgError } = await requireOrgId()
    if (orgError) return orgError

    const orgKey = await orgLeadsApiKey(supabase, orgId)

    if (!orgKey && !isChatbotisticConfigured()) {
      return NextResponse.json({ configured: false }, { status: 200 })
    }

    const { searchParams } = new URL(request.url)

    // Default to the last 30 days when no fromDate is supplied.
    const fromDateParam = searchParams.get('fromDate')
    const fromDate =
      fromDateParam && /^\d{4}-\d{2}-\d{2}$/.test(fromDateParam)
        ? fromDateParam
        : new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

    const pageParam = Number(searchParams.get('page'))
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
    const wantStats = searchParams.get('includeStats') === '1' && page === 1

    const fetchPage = (targetPage: number) =>
      fetchLeads({
        fromDate,
        page: targetPage,
        apiKey: orgKey?.key,
        baseUrl: orgKey?.baseUrl ?? undefined,
      })

    if (!wantStats) {
      const result = await fetchPage(page)
      return NextResponse.json({ configured: true, fromDate, ...result })
    }

    // Stats scan: pull page 1 for the table, then keep going (bounded)
    // so the analytics reflect the whole range, not one 20-row page.
    const all: ChatbotisticLead[] = []
    let pagesScanned = 0
    let more = true
    let firstPageResult: Awaited<ReturnType<typeof fetchPage>> | null = null
    while (more && pagesScanned < STATS_MAX_PAGES) {
      const result = await fetchPage(pagesScanned + 1)
      pagesScanned += 1
      if (pagesScanned === 1) firstPageResult = result
      all.push(...result.leads)
      more = result.hasMore && result.leads.length > 0
    }

    return NextResponse.json({
      configured: true,
      fromDate,
      leads: firstPageResult?.leads ?? [],
      page: firstPageResult?.page ?? 1,
      hasMore: firstPageResult?.hasMore ?? false,
      stats: computeStats(all, pagesScanned, !more),
    })
  } catch (err) {
    if (err instanceof ChatbotisticError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/leads] unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
