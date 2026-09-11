import { NextResponse } from 'next/server'
import { TochatApiError, tochatPublicBase, widgets } from '@/lib/tochat/client'
import { requireTochatScope } from '@/lib/api/tochat-route'
import { orgEntitlements, limitReached } from '@/lib/tochat/entitlements'
import { parseJsonBody } from '@/lib/api/parse-json-body'

/**
 * GET /api/tochat/widgets
 * POST /api/tochat/widgets
 *
 * Thin, org-scoped proxy to the white-label widgets resource. The
 * caller's scope decides isolation (src/lib/tochat/org-config.ts):
 * orgs that connected their own account run entirely inside it, and
 * everyone else is scoped by their `userClient` tag inside the shared
 * master account. Credentials never leave the server.
 *
 * POST enforces the org's plan entitlement (organizations.widget_limit,
 * synced from the SSO bridge) — null/negative means unlimited.
 *
 * Response shape:
 *   { configured: false }                    — no account connected
 *   { configured: true, widgets: [...] }      — GET
 *   { configured: true, widget: {...} }       — POST
 *   { error: '...' }                          — on failure
 */
export async function GET() {
  try {
    const { scope, error } = await requireTochatScope()
    if (error) return error

    const list = await widgets.list(scope)

    return NextResponse.json({
      configured: true,
      widgets: list,
      embedBaseUrl: tochatPublicBase(scope),
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
    const { orgId, supabase, scope, error } = await requireTochatScope()
    if (error) return error

    const { body: payload, error: parseError } = await parseJsonBody(request)
    if (parseError) return parseError
    if (typeof payload.name !== 'string' || !payload.name.trim()) {
      return NextResponse.json({ error: '`name` is required' }, { status: 400 })
    }

    const entitlements = await orgEntitlements(supabase, orgId)
    if (limitReached(entitlements.widget_limit, (await widgets.list(scope)).length)) {
      return NextResponse.json(
        {
          error:
            entitlements.widget_limit != null && entitlements.widget_limit >= 0
              ? `Your ${entitlements.plan ?? 'current'} plan allows ${entitlements.widget_limit} widget(s). Upgrade to add more.`
              : 'Widget limit reached for your plan.',
          limit: entitlements.widget_limit,
        },
        { status: 403 },
      )
    }

    const created = await widgets.create(scope, payload)

    return NextResponse.json({ configured: true, widget: created }, { status: 201 })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/widgets] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
