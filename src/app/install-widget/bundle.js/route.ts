import { NextResponse } from 'next/server'

/**
 * Branded widget loader.
 *
 * The widget itself remains owned and served by the Tochat.be backend. This
 * public façade keeps the customer-facing install code on Chatbotistic while
 * avoiding arbitrary proxy URLs or exposing provider credentials.
 */
const TOCHAT_WIDGET_ORIGIN = 'https://services.tochat.be'
const SAFE_WIDGET_KEY = /^[A-Za-z0-9_-]{3,128}$/

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key')?.trim() ?? ''
  if (!SAFE_WIDGET_KEY.test(key)) {
    return new NextResponse('A valid widget key is required.', { status: 400 })
  }

  const encodedKey = encodeURIComponent(key)
  // Tochat has shipped two public loader shapes over time. Try only the
  // documented fixed paths, in order, so old and new widgets both work while
  // arbitrary upstream proxying remains impossible.
  const upstreamUrls = [
    `${TOCHAT_WIDGET_ORIGIN}/widget/${encodedKey}/load.js`,
    `${TOCHAT_WIDGET_ORIGIN}/build/bundle.js?key=${encodedKey}`,
    `${TOCHAT_WIDGET_ORIGIN}/install-widget/bundle.js?key=${encodedKey}`,
  ]
  try {
    let upstream: Response | null = null
    for (const upstreamUrl of upstreamUrls) {
      const candidate = await fetch(upstreamUrl, {
        headers: { Accept: 'application/javascript, text/javascript;q=0.9, */*;q=0.1' },
        redirect: 'manual',
        next: { revalidate: 300 },
      })
      if (candidate.ok && candidate.status < 300) {
        upstream = candidate
        break
      }
      if (candidate.status !== 404) {
        return new NextResponse('Widget loader temporarily unavailable.', { status: 502 })
      }
    }

    if (!upstream) {
      return new NextResponse('Widget loader not found.', {
        status: 404,
        headers: { 'Cache-Control': 'public, max-age=30' },
      })
    }

    const javascript = await upstream.text()
    return new NextResponse(javascript, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('[install-widget] upstream loader failed:', error)
    return new NextResponse('Widget loader temporarily unavailable.', { status: 502 })
  }
}

export async function HEAD(request: Request) {
  const response = await GET(request)
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  })
}
