import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  ChatbotisticError,
  fetchLeads,
  isChatbotisticConfigured,
} from '@/lib/chatbotistic/client'

/**
 * GET /api/leads?fromDate=YYYY-MM-DD&page=N
 *
 * Auth-gated proxy to the Chatbotistic leads API. The API key stays
 * server-side; the browser only ever talks to this route.
 *
 * Response shape:
 *   { configured: false }                          — integration not set up
 *   { configured: true, leads: [...], page, hasMore }
 *   { error: '...' }                               — on failure
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isChatbotisticConfigured()) {
      return NextResponse.json({ configured: false }, { status: 200 })
    }

    const { searchParams } = new URL(request.url)

    // Default to the last 30 days when no fromDate is supplied.
    const fromDateParam = searchParams.get('fromDate')
    const fromDate =
      fromDateParam && /^\d{4}-\d{2}-\d{2}$/.test(fromDateParam)
        ? fromDateParam
        : new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

    const pageParam = Number(searchParams.get('page'))
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

    const result = await fetchLeads({ fromDate, page })

    return NextResponse.json({
      configured: true,
      fromDate,
      ...result,
    })
  } catch (err) {
    if (err instanceof ChatbotisticError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/leads] unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
