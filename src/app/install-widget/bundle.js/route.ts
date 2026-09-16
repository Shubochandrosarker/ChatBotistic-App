import { NextResponse } from 'next/server'

/**
 * Branded widget loader.
 *
 * Customer sites always load the Chatbotistic URL. Chatbotistic then fetches
 * the provider's current public widget bundle. Keeping this indirection means
 * upstream URL changes can be fixed once, without asking every customer to
 * replace their embed code.
 */
const DEFAULT_TOCHAT_WIDGET_BUNDLE_URL = 'https://widget.tochat.be/bundle.js'
const LEGACY_TOCHAT_WIDGET_ORIGIN = 'https://services.tochat.be'
const SAFE_WIDGET_KEY = /^[A-Za-z0-9_-]{3,128}$/

export const runtime = 'nodejs'

function currentBundleUrl(encodedKey: string): string {
  const configured = process.env.TOCHAT_WIDGET_BUNDLE_URL?.trim()
  const base = configured || DEFAULT_TOCHAT_WIDGET_BUNDLE_URL
  const url = new URL(base)

  if (url.protocol !== 'https:') {
    throw new Error('TOCHAT_WIDGET_BUNDLE_URL must use HTTPS')
  }

  url.searchParams.set('key', encodedKey)
  return url.toString()
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key')?.trim() ?? ''
  if (!SAFE_WIDGET_KEY.test(key)) {
    return new NextResponse('A valid widget key is required.', { status: 400 })
  }

  const encodedKey = encodeURIComponent(key)

  // Current documented loader first. Keep the known services.tochat.be shapes
  // temporarily as compatibility fallbacks for older provider deployments.
  const upstreamUrls = [
    currentBundleUrl(encodedKey),
    `${LEGACY_TOCHAT_WIDGET_ORIGIN}/widget/${encodedKey}/load.js`,
    `${LEGACY_TOCHAT_WIDGET_ORIGIN}/build/bundle.js?key=${encodedKey}`,
    `${LEGACY_TOCHAT_WIDGET_ORIGIN}/install-widget/bundle.js?key=${encodedKey}`,
  ]

  try {
    let upstream: Response | null = null

    for (const upstreamUrl of upstreamUrls) {
      const candidate = await fetch(upstreamUrl, {
        headers: {
          Accept: 'application/javascript, text/javascript;q=0.9, */*;q=0.1',
          'User-Agent': 'Chatbotistic-Widget-Proxy/1.0',
        },
        redirect: 'follow',
        next: { revalidate: 60 },
      })

      if (candidate.ok && candidate.status < 300) {
        upstream = candidate
        break
      }

      // A missing provider route can safely fall through to a known legacy
      // shape. Other failures should not be hidden because they usually mean
      // an upstream outage, authorization failure, or provider-side block.
      if (candidate.status !== 404) {
        console.error(
          `[install-widget] upstream ${upstreamUrl} returned ${candidate.status}`,
        )
        return new NextResponse('Widget loader temporarily unavailable.', {
          status: 502,
          headers: { 'Cache-Control': 'no-store' },
        })
      }
    }

    if (!upstream) {
      return new NextResponse('Widget loader not found.', {
        status: 404,
        headers: { 'Cache-Control': 'public, max-age=30' },
      })
    }

    const javascript = await upstream.text()
    if (!javascript.trim()) {
      return new NextResponse('Widget loader temporarily unavailable.', {
        status: 502,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    return new NextResponse(javascript, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    })
  } catch (error) {
    console.error('[install-widget] upstream loader failed:', error)
    return new NextResponse('Widget loader temporarily unavailable.', {
      status: 502,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}

export async function HEAD(request: Request) {
  const response = await GET(request)
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  })
}
