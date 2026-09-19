import { NextResponse } from 'next/server'
import { verifyPluginToken } from '@/lib/plugin/session'
import { resolveTochatScope } from '@/lib/tochat/org-config'
import { stats, widgets, resourceId } from '@/lib/tochat/client'
import { supabaseAdmin } from '@/lib/automations/admin-client'

/**
 * GET /api/plugin/stats?widget=<id>&days=30&leads=25
 * (Bearer plugin token from /api/plugin/session)
 *
 * Analytics bundle for the plugin's in-dashboard Analytics tab:
 *
 *   { ok, summary: { totalLeads, newLeads, totalClicks, totalViews },
 *     leads: [...], referrals: { referers: [...] } }
 *
 * Shapes mirror what the plugin's analytics views already parse
 * (tochat-compatible keys: totalLeads/totalClicks/totalViews,
 * hydra:member lead rows, referers[] referral rows).
 */
export async function GET(request: Request) {
  const auth = verifyPluginToken(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null)
  if (!auth) {
    return NextResponse.json({ error: 'Invalid or expired plugin session' }, { status: 401 })
  }

  const url = new URL(request.url)
  const widgetId = url.searchParams.get('widget')?.trim() ?? ''
  const days = Math.min(Math.max(Number(url.searchParams.get('days') ?? 30), 1), 365)
  const leadLimit = Math.min(Math.max(Number(url.searchParams.get('leads') ?? 25), 1), 100)

  const admin = supabaseAdmin()
  const scope = await resolveTochatScope(admin, auth.orgId)
  if (!scope) {
    return NextResponse.json({ ok: true, configured: false })
  }

  try {
    // Default to the org's first widget when none specified.
    let target = widgetId
    if (!target) {
      const list = await widgets.list(scope)
      target = resourceId((list as Record<string, unknown>[])[0] ?? {})
    }
    if (!target) {
      return NextResponse.json({ ok: true, configured: true, empty: true })
    }

    const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
    const to = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

    const [widgetStats, leadRows, referralGraph] = await Promise.all([
      stats.widgetStats(scope, target).catch(() => null),
      stats
        .list(scope, {
          'business.uuid': target,
          'order[id]': 'desc',
          itemsPerPage: leadLimit,
        })
        .catch(() => []),
      stats.refererGraph(scope, target, from, to).catch(() => ({ referers: [] })),
    ])

    // Summary KPIs — tochat widget_stats shape (totalLeads/Clicks/Views).
    const ws = (widgetStats ?? {}) as Record<string, unknown>
    const leads = (Array.isArray(leadRows) ? leadRows : []) as Record<string, unknown>[]
    const summary = {
      totalLeads: Number(ws.totalLeads ?? ws.leads ?? leads.length ?? 0),
      newLeads: Number(ws.newLeads ?? leads.filter((l) => !l.isLeadNew === false).length ?? 0),
      totalClicks: Number(ws.totalClicks ?? ws.clicks ?? 0),
      totalViews: Number(ws.totalViews ?? ws.views ?? 0),
    }

    return NextResponse.json({
      ok: true,
      configured: true,
      widget: target,
      summary,
      leads,
      referrals: referralGraph,
    })
  } catch (err) {
    console.error('[api/plugin/stats] failed:', err)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 502 })
  }
}

export const dynamic = 'force-dynamic'
