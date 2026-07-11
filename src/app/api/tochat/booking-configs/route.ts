import { NextResponse } from 'next/server'
import { TochatApiError, isTochatConfigured, bookingConfigs } from '@/lib/tochat/client'
import { requireOrgId } from '@/lib/api/require-org-id'
import { operatorOwnedByOrg } from '@/lib/tochat/ownership'
import {
  validateBookingConfigPayload,
  normalizeBookingConfigPayload,
} from '@/lib/tochat/booking-validation'

/**
 * GET /api/tochat/booking-configs?operatorId={id}
 * POST /api/tochat/booking-configs
 *
 * A booking config belongs to one agent — `operatorId` is required so
 * that ownership (agent → widget → userClient) can be verified before
 * anything is read or written.
 *
 * Response shape:
 *   { configured: false }                               — Tochat not configured
 *   { configured: true, bookingConfigs: [...] }          — GET
 *   { configured: true, bookingConfig: {...} }           — POST
 *   { error: '...' }                                     — on failure
 */
export async function GET(request: Request) {
  try {
    const { orgId, error } = await requireOrgId()
    if (error) return error
    if (!isTochatConfigured()) {
      return NextResponse.json({ configured: false }, { status: 200 })
    }

    const operatorId = new URL(request.url).searchParams.get('operatorId')
    if (!operatorId) {
      return NextResponse.json({ error: '`operatorId` query param is required' }, { status: 400 })
    }

    const operator = await operatorOwnedByOrg(operatorId, orgId)
    if (!operator) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    const list = await bookingConfigs.list(operatorId)
    return NextResponse.json({ configured: true, bookingConfigs: list })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/booking-configs] unexpected error:', err)
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
    if (typeof payload.operatorId !== 'string' || !payload.operatorId.trim()) {
      return NextResponse.json({ error: '`operatorId` is required' }, { status: 400 })
    }
    const validationError = validateBookingConfigPayload(payload)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const operator = await operatorOwnedByOrg(payload.operatorId, orgId)
    if (!operator) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    const created = await bookingConfigs.create({
      whatsapp: `/api/v2/whatsapp_operators/${payload.operatorId}`,
      ...normalizeBookingConfigPayload(payload),
    })

    return NextResponse.json({ configured: true, bookingConfig: created }, { status: 201 })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/booking-configs] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
