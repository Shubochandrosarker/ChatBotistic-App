import { NextResponse } from 'next/server'
import { TochatApiError, isTochatConfigured, widgets } from '@/lib/tochat/client'
import { tochatUserClientForOrg } from '@/lib/tochat/org'
import { requireOrgId } from '@/lib/api/require-org-id'

/**
 * GET /api/tochat/widgets/{id}
 * PUT /api/tochat/widgets/{id}
 * DELETE /api/tochat/widgets/{id}
 *
 * Tochat.be is a single shared master account across every org on this
 * platform — a widget id is not itself a secret, and the API's own
 * `/api/v2/widgets/{id}` endpoint does not scope by caller. Every write
 * below re-fetches the widget first and verifies its `userClient` tag
 * matches the caller's org before touching it, so one org can never
 * edit or delete another org's widget by guessing/knowing its id (see
 * the "keep the re-fetch-and-verify ownership checks" note in
 * ChatBotistic-System-Management/docs/CHATBOTISTIC-DASHBOARD-MASTER-PLAN.md).
 */
async function loadOwnedWidget(id: string, orgId: string) {
  const widget = await widgets.get(id)
  if (widget.userClient !== tochatUserClientForOrg(orgId)) {
    return null
  }
  return widget
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const { orgId, error } = await requireOrgId()
    if (error) return error
    if (!isTochatConfigured()) {
      return NextResponse.json({ configured: false }, { status: 200 })
    }

    const widget = await loadOwnedWidget(id, orgId)
    if (!widget) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ configured: true, widget })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/widgets/:id] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const { orgId, error } = await requireOrgId()
    if (error) return error
    if (!isTochatConfigured()) {
      return NextResponse.json({ configured: false }, { status: 200 })
    }

    const existing = await loadOwnedWidget(id, orgId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const payload = (await request.json()) as Record<string, unknown>
    if (!payload || typeof payload.name !== 'string' || !payload.name.trim()) {
      return NextResponse.json({ error: '`name` is required' }, { status: 400 })
    }

    // userClient is never client-writable — always re-derived from the
    // caller's own org, overriding anything the request body sent.
    const updated = await widgets.update(id, {
      ...payload,
      userClient: tochatUserClientForOrg(orgId),
    })

    return NextResponse.json({ configured: true, widget: updated })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/widgets/:id] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const { orgId, error } = await requireOrgId()
    if (error) return error
    if (!isTochatConfigured()) {
      return NextResponse.json({ configured: false }, { status: 200 })
    }

    const existing = await loadOwnedWidget(id, orgId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await widgets.remove(id)
    return NextResponse.json({ configured: true, ok: true })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/widgets/:id] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
