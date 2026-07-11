import { NextResponse } from 'next/server'
import {
  TochatApiError,
  isTochatConfigured,
  operators,
  widgets,
  resourceIdFromIri,
  type TochatOperator,
} from '@/lib/tochat/client'
import { tochatUserClientForOrg } from '@/lib/tochat/org'
import { requireOrgId } from '@/lib/api/require-org-id'

/**
 * GET /api/tochat/operators/{id}
 * PUT /api/tochat/operators/{id}
 * DELETE /api/tochat/operators/{id}
 *
 * Same shared-master-account concern as /api/tochat/widgets/{id}: an
 * operator id alone doesn't prove it's the caller's. Ownership is
 * verified one level removed — resolve the operator's parent widget
 * (`business`) and check *that* widget's `userClient` tag.
 */
async function loadOwnedOperator(id: string, orgId: string): Promise<TochatOperator | null> {
  const operator = (await operators.get(id)) as TochatOperator
  const widgetId = resourceIdFromIri(operator.business)
  if (!widgetId) return null

  const widget = await widgets.get(widgetId)
  if (widget.userClient !== tochatUserClientForOrg(orgId)) return null

  return operator
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

    const operator = await loadOwnedOperator(id, orgId)
    if (!operator) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ configured: true, operator })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/operators/:id] unexpected error:', err)
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

    const existing = await loadOwnedOperator(id, orgId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const payload = (await request.json()) as Record<string, unknown>
    if (!payload || typeof payload.name !== 'string' || !payload.name.trim()) {
      return NextResponse.json({ error: '`name` is required' }, { status: 400 })
    }
    if (typeof payload.number !== 'string' || !payload.number.trim()) {
      return NextResponse.json({ error: '`number` is required' }, { status: 400 })
    }

    // Moving an operator to a different widget re-verifies the new
    // widget belongs to the same org; otherwise keep its current one.
    let businessIri = existing.business
    if (typeof payload.business === 'string' && payload.business.trim()) {
      const targetWidget = await widgets.get(payload.business)
      if (targetWidget.userClient !== tochatUserClientForOrg(orgId)) {
        return NextResponse.json({ error: 'Widget not found' }, { status: 404 })
      }
      businessIri = `/api/v2/widgets/${payload.business}`
    }

    const updated = await operators.update(id, { ...payload, business: businessIri })
    return NextResponse.json({ configured: true, operator: updated })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/operators/:id] unexpected error:', err)
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

    const existing = await loadOwnedOperator(id, orgId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await operators.remove(id)
    return NextResponse.json({ configured: true, ok: true })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/operators/:id] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
