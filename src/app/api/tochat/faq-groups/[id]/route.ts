import { NextResponse } from 'next/server'
import {
  TochatApiError,
  faqGroups,
  resourceIdFromIri,
  type TochatFaq,
} from '@/lib/tochat/client'
import { requireTochatScope } from '@/lib/api/tochat-route'
import { faqGroupOwnedByOrg } from '@/lib/tochat/ownership'
import { parseJsonBody } from '@/lib/api/parse-json-body'

/**
 * GET /api/tochat/faq-groups/{id}
 * PUT /api/tochat/faq-groups/{id}
 * DELETE /api/tochat/faq-groups/{id}
 *
 * Ownership is verified two levels removed — resolve the FAQ group's
 * agent (`whatsapp`), then that agent's widget, and check the
 * widget's `userClient` tag (see src/lib/tochat/ownership.ts).
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const { scope, error } = await requireTochatScope()
    if (error) return error

    const group = await faqGroupOwnedByOrg(scope, id)
    if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ configured: true, faqGroup: group })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/faq-groups/:id] unexpected error:', err)
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

    const existing = await faqGroupOwnedByOrg(scope, id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { body: payload, error: parseError } = await parseJsonBody(request)
    if (parseError) return parseError
    if (typeof payload.title !== 'string' || !payload.title.trim()) {
      return NextResponse.json({ error: '`title` is required' }, { status: 400 })
    }
    if (!validFaqs(payload.faqs)) {
      return NextResponse.json(
        { error: 'At least one FAQ with a question and answer is required' },
        { status: 400 },
      )
    }

    // The agent this group belongs to never changes via this route —
    // keep the existing relation regardless of what the body sends.
    // Re-derived as a plain IRI rather than re-sent as whatever shape
    // GET returned it in (a string IRI or an embedded {id, '@id'}
    // object depending on Tochat's serialization group) — PUT expects
    // the IRI form, so resending an embedded object could silently
    // detach the group from its agent.
    const operatorId = resourceIdFromIri(existing.whatsapp)
    if (!operatorId) {
      console.error('[api/tochat/faq-groups/:id] existing.whatsapp had an unrecognized shape:', existing.whatsapp)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
    const updated = await faqGroups.update(scope, id, {
      title: payload.title.trim(),
      whatsapp: `/api/v2/whatsapp_operators/${operatorId}`,
      faqs: payload.faqs,
    })

    return NextResponse.json({ configured: true, faqGroup: updated })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/faq-groups/:id] unexpected error:', err)
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

    const existing = await faqGroupOwnedByOrg(scope, id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await faqGroups.remove(scope, id)
    return NextResponse.json({ configured: true, ok: true })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/faq-groups/:id] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
