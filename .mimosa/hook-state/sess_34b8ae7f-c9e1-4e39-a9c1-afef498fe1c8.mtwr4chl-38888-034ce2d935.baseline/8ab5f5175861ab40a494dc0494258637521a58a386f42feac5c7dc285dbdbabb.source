import { NextResponse } from 'next/server'
import {
  TochatApiError,
  isTochatConfigured,
  bookingConfigs,
  resourceIdFromIri,
} from '@/lib/tochat/client'
import { requireOrgId } from '@/lib/api/require-org-id'
import { bookingConfigOwnedByOrg } from '@/lib/tochat/ownership'
import { parseJsonBody } from '@/lib/api/parse-json-body'
import {
  validateBookingConfigPayload,
  normalizeBookingConfigPayload,
} from '@/lib/tochat/booking-validation'

/**
 * GET /api/tochat/booking-configs/{id}
 * PUT /api/tochat/booking-configs/{id}
 * DELETE /api/tochat/booking-configs/{id}
 *
 * Ownership is verified two levels removed — resolve the config's
 * agent (`whatsapp`), then that agent's widget, and check the
 * widget's `userClient` tag (see src/lib/tochat/ownership.ts).
 */
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

    const config = await bookingConfigOwnedByOrg(id, orgId)
    if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ configured: true, bookingConfig: config })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/booking-configs/:id] unexpected error:', err)
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

    const existing = await bookingConfigOwnedByOrg(id, orgId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { body: payload, error: parseError } = await parseJsonBody(request)
    if (parseError) return parseError
    const validationError = validateBookingConfigPayload(payload)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // The agent this config belongs to never changes via this route —
    // re-derived as a plain IRI rather than re-sent as whatever shape
    // GET returned it in (see the identical note in
    // faq-groups/[id]/route.ts).
    const operatorId = resourceIdFromIri(existing.whatsapp)
    if (!operatorId) {
      console.error('[api/tochat/booking-configs/:id] existing.whatsapp had an unrecognized shape:', existing.whatsapp)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
    const updated = await bookingConfigs.update(id, {
      whatsapp: `/api/v2/whatsapp_operators/${operatorId}`,
      ...normalizeBookingConfigPayload(payload),
    })

    return NextResponse.json({ configured: true, bookingConfig: updated })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/booking-configs/:id] unexpected error:', err)
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

    const existing = await bookingConfigOwnedByOrg(id, orgId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await bookingConfigs.remove(id)
    return NextResponse.json({ configured: true, ok: true })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/booking-configs/:id] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
