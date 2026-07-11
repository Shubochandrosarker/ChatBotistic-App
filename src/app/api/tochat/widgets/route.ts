import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TochatApiError, isTochatConfigured, widgets } from '@/lib/tochat/client'
import { tochatUserClientForOrg } from '@/lib/tochat/org'

/**
 * GET /api/tochat/widgets
 * POST /api/tochat/widgets
 *
 * Thin, org-scoped proxy to the Tochat.be widgets resource — the first
 * slice of the Widget Studio integration. The master Tochat.be
 * credentials never leave the server; every call is scoped to the
 * signed-in user's org via the `userClient` tag.
 *
 * Response shape:
 *   { configured: false }                    — TOCHAT_API_EMAIL/PASSWORD not set
 *   { configured: true, widgets: [...] }      — GET
 *   { configured: true, widget: {...} }       — POST
 *   { error: '...' }                          — on failure
 */
async function requireOrgId(): Promise<
  { orgId: string; error: null } | { orgId: null; error: NextResponse }
> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { orgId: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  // RLS scopes this to orgs the caller belongs to — no explicit
  // user_id/org_id filter needed (see docs/dashboard-bug-audit-2026-07-11.md
  // for why several other routes get this wrong).
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (orgError || !org) {
    return {
      orgId: null,
      error: NextResponse.json({ error: 'No organization for this account' }, { status: 404 }),
    }
  }

  return { orgId: org.id as string, error: null }
}

export async function GET() {
  try {
    const { orgId, error } = await requireOrgId()
    if (error) return error

    if (!isTochatConfigured()) {
      return NextResponse.json({ configured: false }, { status: 200 })
    }

    const userClient = tochatUserClientForOrg(orgId)
    const list = await widgets.list(userClient)

    return NextResponse.json({ configured: true, widgets: list })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/widgets] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { orgId, error } = await requireOrgId()
    if (error) return error

    if (!isTochatConfigured()) {
      return NextResponse.json({ configured: false }, { status: 200 })
    }

    const payload = (await request.json()) as Record<string, unknown>
    if (!payload || typeof payload.name !== 'string' || !payload.name.trim()) {
      return NextResponse.json({ error: '`name` is required' }, { status: 400 })
    }

    const userClient = tochatUserClientForOrg(orgId)
    const created = await widgets.create({ ...payload, userClient })

    return NextResponse.json({ configured: true, widget: created }, { status: 201 })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/widgets] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
