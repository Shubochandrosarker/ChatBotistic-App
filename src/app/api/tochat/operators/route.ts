import { NextResponse } from 'next/server'
import { TochatApiError, operators } from '@/lib/tochat/client'
import { requireTochatScope } from '@/lib/api/tochat-route'
import { widgetOwnedByOrg } from '@/lib/tochat/ownership'
import { orgEntitlements, limitReached } from '@/lib/tochat/entitlements'
import { parseJsonBody } from '@/lib/api/parse-json-body'

/**
 * GET /api/tochat/operators
 * POST /api/tochat/operators
 *
 * Org-scoped proxy to the white-label WhatsApp operator (agent)
 * resource. An operator always belongs to one widget (`business`); the
 * `business` field in the request/response bodies below is a plain
 * widget id, not the raw Hydra IRI — this route translates between
 * them so the UI never has to know the IRI shape.
 *
 * POST enforces the org's plan entitlement (organizations.agent_limit).
 *
 * Response shape:
 *   { configured: false }                       — no account connected
 *   { configured: true, operators: [...] }       — GET
 *   { configured: true, operator: {...} }        — POST
 *   { error: '...' }                             — on failure
 */
export async function GET() {
  try {
    const { scope, error } = await requireTochatScope()
    if (error) return error

    const list = await operators.list(scope)

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
    const { orgId, supabase, scope, error } = await requireTochatScope({ action: true })
    if (error) return error

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
    const widget = await widgetOwnedByOrg(scope, payload.business)
    if (!widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 })
    }

    const entitlements = await orgEntitlements(supabase, orgId)
    if (limitReached(entitlements.agent_limit, (await operators.list(scope)).length)) {
      return NextResponse.json(
        {
          error:
            entitlements.agent_limit != null && entitlements.agent_limit >= 0
              ? `Your ${entitlements.plan ?? 'current'} plan allows ${entitlements.agent_limit} agent(s). Upgrade to add more.`
              : 'Agent limit reached for your plan.',
          limit: entitlements.agent_limit,
        },
        { status: 403 },
      )
    }

    const created = await operators.create(scope, {
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
