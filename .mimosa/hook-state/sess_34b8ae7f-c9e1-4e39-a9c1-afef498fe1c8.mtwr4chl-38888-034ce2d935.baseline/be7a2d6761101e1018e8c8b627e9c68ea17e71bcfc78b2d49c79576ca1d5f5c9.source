import { NextResponse } from 'next/server'
import { TochatApiError, isTochatConfigured, tochatPublicBase, widgets } from '@/lib/tochat/client'
import { tochatUserClientForOrg } from '@/lib/tochat/org'
import { requireOrgId } from '@/lib/api/require-org-id'
import { parseJsonBody } from '@/lib/api/parse-json-body'

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
export async function GET() {
  try {
    const { orgId, error } = await requireOrgId()
    if (error) return error

    if (!isTochatConfigured()) {
      return NextResponse.json({ configured: false }, { status: 200 })
    }

    const userClient = tochatUserClientForOrg(orgId)
    const list = await widgets.list(userClient)

    return NextResponse.json({
      configured: true,
      widgets: list,
      embedBaseUrl: tochatPublicBase(),
    })
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

    const { body: payload, error: parseError } = await parseJsonBody(request)
    if (parseError) return parseError
    if (typeof payload.name !== 'string' || !payload.name.trim()) {
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
