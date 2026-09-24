import { NextResponse } from 'next/server'
import { TochatApiError, widgets } from '@/lib/tochat/client'
import { requireTochatScope } from '@/lib/api/tochat-route'
import { widgetOwnedByOrg } from '@/lib/tochat/ownership'
import { parseJsonBody } from '@/lib/api/parse-json-body'

/**
 * GET /api/tochat/widgets/{id}
 * PUT /api/tochat/widgets/{id}
 * DELETE /api/tochat/widgets/{id}
 *
 * A widget id is not itself a secret and the upstream API does not
 * scope by caller in shared mode. Every handler re-fetches the widget
 * first and verifies ownership (src/lib/tochat/ownership.ts — tag walk
 * in shared mode, JWT scope in isolated mode), so one org can never
 * read, edit or delete another org's widget by guessing its id.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const { scope, error } = await requireTochatScope()
    if (error) return error

    const widget = await widgetOwnedByOrg(scope, id)
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
    const { scope, error } = await requireTochatScope({ action: true })
    if (error) return error

    const existing = await widgetOwnedByOrg(scope, id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { body: payload, error: parseError } = await parseJsonBody(request)
    if (parseError) return parseError
    if (typeof payload.name !== 'string' || !payload.name.trim()) {
      return NextResponse.json({ error: '`name` is required' }, { status: 400 })
    }

    // userClient is never client-writable. In shared mode it is always
    // re-derived from the caller's own tag; in isolated mode it is
    // stripped from the payload so the account's own grouping is
    // preserved untouched.
    const { userClient, ...rest } = payload
    const updated = await widgets.update(scope, id, {
      ...rest,
      ...(scope.userClient ? { userClient: scope.userClient } : {}),
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
    const { scope, error } = await requireTochatScope({ action: true })
    if (error) return error

    const existing = await widgetOwnedByOrg(scope, id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await widgets.remove(scope, id)
    return NextResponse.json({ configured: true, ok: true })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/widgets/:id] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
