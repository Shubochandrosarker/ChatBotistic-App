import { NextResponse } from 'next/server'
import { TochatApiError, isTochatConfigured, faqGroups, type TochatFaq } from '@/lib/tochat/client'
import { requireOrgId } from '@/lib/api/require-org-id'
import { faqGroupOwnedByOrg } from '@/lib/tochat/ownership'

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
    const { orgId, error } = await requireOrgId()
    if (error) return error
    if (!isTochatConfigured()) {
      return NextResponse.json({ configured: false }, { status: 200 })
    }

    const group = await faqGroupOwnedByOrg(id, orgId)
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
    const { orgId, error } = await requireOrgId()
    if (error) return error
    if (!isTochatConfigured()) {
      return NextResponse.json({ configured: false }, { status: 200 })
    }

    const existing = await faqGroupOwnedByOrg(id, orgId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const payload = (await request.json()) as Record<string, unknown>
    if (!payload || typeof payload.title !== 'string' || !payload.title.trim()) {
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
    const updated = await faqGroups.update(id, {
      title: payload.title.trim(),
      whatsapp: existing.whatsapp,
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
    const { orgId, error } = await requireOrgId()
    if (error) return error
    if (!isTochatConfigured()) {
      return NextResponse.json({ configured: false }, { status: 200 })
    }

    const existing = await faqGroupOwnedByOrg(id, orgId)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await faqGroups.remove(id)
    return NextResponse.json({ configured: true, ok: true })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/faq-groups/:id] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
