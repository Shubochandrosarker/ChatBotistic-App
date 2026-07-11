import { NextResponse } from 'next/server'
import { TochatApiError, isTochatConfigured, faqGroups, type TochatFaq } from '@/lib/tochat/client'
import { requireOrgId } from '@/lib/api/require-org-id'
import { operatorOwnedByOrg } from '@/lib/tochat/ownership'

/**
 * GET /api/tochat/faq-groups?operatorId={id}
 * POST /api/tochat/faq-groups
 *
 * FAQ groups belong to one agent (`whatsapp`), which itself belongs to
 * one widget — `operatorId` is required on every call so we can verify
 * that two-level ownership chain before touching anything.
 *
 * Response shape:
 *   { configured: false }                          — Tochat not configured
 *   { configured: true, faqGroups: [...] }          — GET
 *   { configured: true, faqGroup: {...} }           — POST
 *   { error: '...' }                                — on failure
 */
function validFaqs(value: unknown): value is TochatFaq[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (f) =>
        f &&
        typeof f === 'object' &&
        typeof (f as TochatFaq).question === 'string' &&
        (f as TochatFaq).question.trim() &&
        typeof (f as TochatFaq).answer === 'string' &&
        (f as TochatFaq).answer.trim(),
    )
  )
}

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

    const list = await faqGroups.list(operatorId)
    return NextResponse.json({ configured: true, faqGroups: list })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/faq-groups] unexpected error:', err)
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
    if (!payload || typeof payload.title !== 'string' || !payload.title.trim()) {
      return NextResponse.json({ error: '`title` is required' }, { status: 400 })
    }
    if (typeof payload.operatorId !== 'string' || !payload.operatorId.trim()) {
      return NextResponse.json({ error: '`operatorId` is required' }, { status: 400 })
    }
    if (!validFaqs(payload.faqs)) {
      return NextResponse.json(
        { error: 'At least one FAQ with a question and answer is required' },
        { status: 400 },
      )
    }

    const operator = await operatorOwnedByOrg(payload.operatorId, orgId)
    if (!operator) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

    const created = await faqGroups.create({
      title: payload.title.trim(),
      whatsapp: `/api/v2/whatsapp_operators/${payload.operatorId}`,
      faqs: payload.faqs,
    })

    return NextResponse.json({ configured: true, faqGroup: created }, { status: 201 })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/faq-groups] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
