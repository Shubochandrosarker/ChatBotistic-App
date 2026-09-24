import { NextResponse } from 'next/server'
import { TochatApiError, operators, resourceIdFromIri } from '@/lib/tochat/client'
import { requireTochatScope } from '@/lib/api/tochat-route'
import { operatorOwnedByOrg, widgetOwnedByOrg } from '@/lib/tochat/ownership'
import { parseJsonBody } from '@/lib/api/parse-json-body'

/**
 * GET /api/tochat/operators/{id}
 * PUT /api/tochat/operators/{id}
 * DELETE /api/tochat/operators/{id}
 *
 * Ownership is verified before any read/write (see
 * src/lib/tochat/ownership.ts) — in shared mode by walking up to the
 * parent widget's `userClient` tag, in isolated mode by the org's own
 * account JWT.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const { scope, error } = await requireTochatScope()
    if (error) return error

    const operator = await operatorOwnedByOrg(scope, id)
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
    const { scope, error } = await requireTochatScope({ action: true })
    if (error) return error

    const existing = await operatorOwnedByOrg(scope, id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { body: payload, error: parseError } = await parseJsonBody(request)
    if (parseError) return parseError
    if (typeof payload.name !== 'string' || !payload.name.trim()) {
      return NextResponse.json({ error: '`name` is required' }, { status: 400 })
    }
    if (typeof payload.number !== 'string' || !payload.number.trim()) {
      return NextResponse.json({ error: '`number` is required' }, { status: 400 })
    }

    // Moving an operator to a different widget re-verifies the new
    // widget belongs to the same org; otherwise keep its current one —
    // re-derived as a plain IRI rather than re-sent as whatever shape
    // GET returned it in (a string IRI or an embedded {id, '@id'}
    // object depending on the upstream serialization group), since PUT
    // expects the IRI form.
    let businessId: string | null
    if (typeof payload.business === 'string' && payload.business.trim()) {
      const targetWidget = await widgetOwnedByOrg(scope, payload.business)
      if (!targetWidget) {
        return NextResponse.json({ error: 'Widget not found' }, { status: 404 })
      }
      businessId = payload.business
    } else {
      businessId = resourceIdFromIri(existing.business)
    }
    if (!businessId) {
      console.error('[api/tochat/operators/:id] existing.business had an unrecognized shape:', existing.business)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const updated = await operators.update(scope, id, {
      ...payload,
      business: `/api/v2/widgets/${businessId}`,
    })
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
    const { scope, error } = await requireTochatScope({ action: true })
    if (error) return error

    const existing = await operatorOwnedByOrg(scope, id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await operators.remove(scope, id)
    return NextResponse.json({ configured: true, ok: true })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/operators/:id] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
