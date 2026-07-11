import { NextResponse } from 'next/server'
import { TochatApiError, isTochatConfigured, operators } from '@/lib/tochat/client'
import { tochatUserClientForOrg } from '@/lib/tochat/org'
import { requireOrgId } from '@/lib/api/require-org-id'
import { widgetOwnedByOrg } from '@/lib/tochat/ownership'
import { parseJsonBody } from '@/lib/api/parse-json-body'

/**
 * GET /api/tochat/operators
 * POST /api/tochat/operators
 *
 * Org-scoped proxy to the Tochat.be WhatsApp operator (agent)
 * resource. An operator always belongs to one widget (`business`); the
 * `business` field in the request/response bodies below is a plain
 * widget id, not the raw Hydra IRI — this route translates between
 * them so the UI never has to know the IRI shape.
 *
 * Response shape:
 *   { configured: false }                       — Tochat not configured
 *   { configured: true, operators: [...] }       — GET
 *   { configured: true, operator: {...} }        — POST
 *   { error: '...' }                             — on failure
 */
export async function GET() {
  try {
    const { orgId, error } = await requireOrgId()
    if (error) return error

    if (!isTochatConfigured()) {
      return NextResponse.json({ configured: false }, { status: 200 })
    }

    const userClient = tochatUserClientForOrg(orgId)
    const list = await operators.list(userClient)

    return NextResponse.json({ configured: true, operators: list })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/operators] unexpected error:', err)
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
    if (typeof payload.number !== 'string' || !payload.number.trim()) {
      return NextResponse.json({ error: '`number` is required' }, { status: 400 })
    }
    if (typeof payload.business !== 'string' || !payload.business.trim()) {
      return NextResponse.json({ error: '`business` (widget id) is required' }, { status: 400 })
    }

    // The operator must attach to a widget the caller's org actually
    // owns — verify before creating, same rule as every other write.
    const widget = await widgetOwnedByOrg(payload.business, orgId)
    if (!widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 })
    }

    const created = await operators.create({
      ...payload,
      business: `/api/v2/widgets/${payload.business}`,
    })

    return NextResponse.json({ configured: true, operator: created }, { status: 201 })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/operators] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
