// SSRF guard for server-side fetches of user-supplied URLs (the FAQ
// scanner's sitemap/page fetches).
//
// Threat model: an authenticated user asks the app to fetch a URL.
// Without these checks that fetch can be pointed at cloud metadata
// endpoints (169.254.169.254), loopback services, or RFC1918 hosts —
// and a DNS rebinding attack can flip the answer between the
// validation lookup and the actual connect.
//
// The guard therefore does two things:
//
//   1. validate — resolve the hostname once and reject the URL if ANY
//      resolved address is private, reserved, or non-routable
//      (isPrivateAddress below is deliberately exhaustive);
//
//   2. pin — fetch through a custom DNS `lookup` that always returns
//      the address validated in step 1. The connection can never be
//      re-resolved to a different (rebound) address, while the Host
//      header, SNI, and TLS certificate validation all still check
//      the real hostname.
//
// Redirects are not followed: a redirect target would need its own
// validation pass, and none of the callers need them.

import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { LookupAddress } from 'node:dns'
import type { LookupFunction } from 'node:net'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'

function fail(message: string): never {
  throw new Error(message)
}

// ---- Address classification ---------------------------------------------

/**
 * True for every address that must never be fetched: loopback,
 * RFC1918, CGNAT, link-local (incl. cloud metadata), shared/address-
 * space benchmarks, documentation/test ranges, multicast, reserved,
 * and their IPv6 equivalents including IPv4-mapped and NAT64 forms.
 */
export function isPrivateAddress(rawAddress: string): boolean {
  const address = rawAddress.trim().toLowerCase().replace(/^\[|\]$/g, '')

  // IPv4-mapped IPv6 — classify the embedded IPv4 address. Handles
  // both the dotted (::ffff:10.0.0.1) and hex (::ffff:a00:1) forms.
  const hexMapped = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16)
    const lo = parseInt(hexMapped[2], 16)
    return isPrivateAddress(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`)
  }
  const dottedMapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (dottedMapped) return isPrivateAddress(dottedMapped[1])

  const family = isIP(address)
  if (family === 4) {
    const [a, b] = address.split('.').map(Number)
    return (
      a === 0 ||                                    // 0.0.0.0/8 "this host"
      a === 10 ||                                   // 10.0.0.0/8 private
      (a === 100 && b >= 64 && b <= 127) ||         // 100.64.0.0/10 CGNAT
      a === 127 ||                                  // 127.0.0.0/8 loopback
      (a === 169 && b === 254) ||                   // 169.254.0.0/16 link-local + metadata
      (a === 172 && b >= 16 && b <= 31) ||          // 172.16.0.0/12 private
      (a === 192 && b === 0 && address.startsWith('192.0.0.')) || // 192.0.0.0/24
      (a === 192 && b === 0 && address.startsWith('192.0.2.')) || // 192.0.2.0/24 TEST-NET-1
      (a === 192 && b === 168) ||                   // 192.168.0.0/16 private
      (a === 198 && (b === 18 || b === 19)) ||      // 198.18.0.0/15 benchmark
      (a === 198 && b === 51 && address.startsWith('198.51.100.')) || // TEST-NET-2
      (a === 203 && b === 0 && address.startsWith('203.0.113.')) ||   // TEST-NET-3
      a >= 240                                      // 240.0.0.0/4 reserved + broadcast
    )
  }
  if (family === 6) {
    return (
      address === '::' ||                            // unspecified
      address === '::1' ||                           // loopback
      address.startsWith('64:ff9b:') ||              // NAT64 well-known prefix
      address.startsWith('100:') ||                  // 100::/64 discard-only
      address.startsWith('2001:db8:') ||             // documentation
      address.startsWith('2002:') ||                 // 6to4 (can embed RFC1918)
      address.startsWith('fc') ||
      address.startsWith('fd') ||                    // fc00::/7 unique local
      address.startsWith('fe8') ||
      address.startsWith('fe9') ||
      address.startsWith('fea') ||
      address.startsWith('feb') ||                   // fe80::/10 link-local
      address.startsWith('ff')                       // ff00::/8 multicast
    )
  }

  // Not a recognizable IP literal — hostnames are resolved and their
  // addresses classified before any fetch; a bare string here means
  // "unknown", and unknown is treated as private (deny).
  return true
}

// ---- URL validation -------------------------------------------------------

export interface ValidatedUrl {
  /** The parsed URL (hostname already WHATWG-normalized, so integer or
   *  octal IPv4 tricks like http://2130706433 arrive as dotted quad). */
  url: URL
  /** The address every fetch of this URL must be pinned to. */
  address: string
  family: 4 | 6
}

/**
 * Parse and resolve a user-supplied URL, rejecting anything that is
 * not a plain http(s) URL to a public, routable address. Resolves
 * once — callers keep the resolved address and pass it to
 * `fetchTextPinned` so the hostname is never looked up again.
 */
export async function assertPublicUrl(raw: string): Promise<ValidatedUrl> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    fail(`Invalid URL: ${raw}`)
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    fail('Only HTTP and HTTPS URLs are allowed.')
  }
  if (
    url.username ||
    url.password ||
    url.hostname === 'localhost' ||
    url.hostname === 'localhost.' ||
    url.hostname.endsWith('.local') ||
    url.hostname.endsWith('.local.') ||
    url.hostname.endsWith('.internal')
  ) {
    fail('Private, local, and credentialed URLs are not allowed.')
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  let address: string
  let family: 4 | 6
  if (isIP(hostname)) {
    address = hostname
    family = (isIP(hostname) as 4 | 6) || 4
  } else {
    let entries: Array<{ address: string; family: number }>
    try {
      entries = await dnsLookup(hostname, { all: true, verbatim: true })
    } catch {
      fail(`Could not resolve ${hostname}.`)
    }
    // If ANY resolved address is private, reject outright: a hostname
    // with mixed public/private answers is exactly what a rebinding
    // attacker returns, and "just pick a public one" would race.
    for (const entry of entries) {
      if (isPrivateAddress(entry.address)) {
        fail('The requested URL resolves to a private network address.')
      }
    }
    const first = entries[0]
    if (!first) fail(`Could not resolve ${hostname}.`)
    address = first.address
    family = first.family === 6 ? 6 : 4
  }
  if (isPrivateAddress(address)) {
    fail('The requested URL resolves to a private network address.')
  }
  return { url, address, family }
}

// ---- Pinned fetch ---------------------------------------------------------

function pinnedLookup(address: string, family: number): LookupFunction {
  return (_hostname, options, callback) => {
    if (options && options.all) {
      (callback as unknown as (err: Error | null, addresses: LookupAddress[]) => void)(
        null,
        [{ address, family }],
      )
    } else {
      (callback as unknown as (err: Error | null, addr: string, fam: number) => void)(
        null,
        address,
        family,
      )
    }
  }
}

export interface FetchLimits {
  timeoutMs: number
  maxBytes: number
}

/**
 * GET a URL whose hostname has already been validated, connecting only
 * to `validated.address` (never re-resolving). Redirects are rejected,
 * the response body is truncated at maxBytes, and the request aborts
 * after timeoutMs.
 */
export async function fetchTextPinned(
  validated: ValidatedUrl,
  limits: FetchLimits,
  userAgent = 'ChatbotisticFaqScanner/1.0',
): Promise<string> {
  const { url } = validated
  const send = url.protocol === 'https:' ? httpsRequest : httpRequest
  return await new Promise<string>((resolve, reject) => {
    const req = send(url, {
      lookup: pinnedLookup(validated.address, validated.family),
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html, application/xml, text/xml;q=0.9',
      },
      timeout: limits.timeoutMs,
    })
    const chunks: Buffer[] = []
    let total = 0
    let settled = false

    function finish(error: Error | null, body?: string) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve(body ?? '')
    }

    const timer = setTimeout(() => {
      req.destroy(new Error(`Fetch of ${url.href} timed out.`))
    }, limits.timeoutMs)

    req.on('timeout', () => {
      req.destroy(new Error(`Fetch of ${url.href} timed out.`))
    })
    req.on('error', (err) => finish(err))
    req.on('response', (response) => {
      if (response.statusCode && response.statusCode >= 300) {
        const where = response.headers.location
          ? ` (redirects to ${response.headers.location})`
          : ''
        response.resume()
        finish(new Error(`Redirects are not allowed when fetching ${url.href}${where}.`))
        req.destroy()
        return
      }
      response.on('data', (chunk: Buffer) => {
        total += chunk.byteLength
        chunks.push(chunk)
        if (total >= limits.maxBytes) {
          response.destroy()
          finish(null, Buffer.concat(chunks).subarray(0, limits.maxBytes).toString('utf8'))
        }
      })
      response.on('end', () => finish(null, Buffer.concat(chunks).toString('utf8')))
      response.on('error', (err) => finish(err))
    })
    req.end()
  })
}
