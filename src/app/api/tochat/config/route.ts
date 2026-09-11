import { NextResponse } from 'next/server'
import { TochatApiError, verifyTochatLogin, normalizeTochatBase } from '@/lib/tochat/client'
import { requireOrgId } from '@/lib/api/require-org-id'
import {
  tochatStatusForOrg,
  connectOrgAccount,
  disconnectOrgAccount,
  saveOrgLeadsApiKey,
} from '@/lib/tochat/org-config'
import { parseJsonBody } from '@/lib/api/parse-json-body'

/**
 * GET /api/tochat/config
 * POST /api/tochat/config          — connect the org's own account
 * PUT /api/tochat/config           — save the optional leads API key
 * DELETE /api/tochat/config        — disconnect the account
 *
 * Lets each org connect its OWN white-label account (email+password),
 * verified against the live API before anything is stored, then
 * AES-256-GCM encrypted (src/lib/whatsapp/encryption.ts). From then
 * on every Widget Studio call runs inside that account — the org only
 * ever sees its own widgets. The tenancy tag (`user_client`) survives
 * connect/disconnect unchanged.
 */

/**
 * True only for IPv4 literals outside loopback / private / link-local /
 * reserved ranges. IPv6 literals are refused (the white-label API is a
 * public DNS name; a literal IPv6 origin has no legitimate use here).
 */
function isPublicIpv4(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) return false
  const octets = parts.map((p) => Number(p))
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b] = octets as [number, number, number, number]
  if (a === 127 || a === 10 || a === 0) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 168) return false
  if (a === 169 && b === 254) return false
  if (a === 127) return false
  if (a >= 224) return false // multicast + reserved
  return true
}

export async function GET() {
  try {
    const { orgId, supabase, error } = await requireOrgId()
    if (error) return error

    const status = await tochatStatusForOrg(supabase, orgId)
    return NextResponse.json({ status })
  } catch (err) {
    console.error('[api/tochat/config] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { orgId, supabase, error } = await requireOrgId()
    if (error) return error

    const { body: payload, error: parseError } = await parseJsonBody(request)
    if (parseError) return parseError
    if (typeof payload.email !== 'string' || !payload.email.trim()) {
      return NextResponse.json({ error: '`email` is required' }, { status: 400 })
    }
    if (typeof payload.password !== 'string' || !payload.password) {
      return NextResponse.json({ error: '`password` is required' }, { status: 400 })
    }
    let apiBase: string | null = null
    if (payload.apiBase != null) {
      if (typeof payload.apiBase !== 'string') {
        return NextResponse.json({ error: '`apiBase` must be a URL string' }, { status: 400 })
      }
      try {
        apiBase = normalizeTochatBase(payload.apiBase)
        const parsed = new URL(apiBase)
        if (parsed.protocol !== 'https:') {
          return NextResponse.json({ error: '`apiBase` must use https' }, { status: 400 })
        }
        // SSRF guard: the origin is fetched server-side with credentials,
        // so loopback / private / link-local hosts are refused outright.
        const host = parsed.hostname.toLowerCase()
        const isIp = /^[0-9.]+$/.test(host) || host.includes(':')
        if (
          host === 'localhost' ||
          host.endsWith('.localhost') ||
          host.endsWith('.internal') ||
          host === 'metadata.google.internal' ||
          (isIp && !isPublicIpv4(host))
        ) {
          return NextResponse.json({ error: '`apiBase` must be a public host' }, { status: 400 })
        }
      } catch {
        return NextResponse.json({ error: '`apiBase` is not a valid URL' }, { status: 400 })
      }
    }

    // Verify the pair against the live API BEFORE storing anything —
    // a typo'd password would otherwise silently break every later
    // call with confusing 401s.
    await verifyTochatLogin(payload.email.trim(), payload.password, apiBase)

    await connectOrgAccount(supabase, orgId, payload.email.trim(), payload.password, apiBase)

    const status = await tochatStatusForOrg(supabase, orgId)
    return NextResponse.json({ connected: true, status })
  } catch (err) {
    if (err instanceof TochatApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[api/tochat/config] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { orgId, supabase, error } = await requireOrgId()
    if (error) return error

    const { body: payload, error: parseError } = await parseJsonBody(request)
    if (parseError) return parseError
    if (payload.leadsApiKey != null && typeof payload.leadsApiKey !== 'string') {
      return NextResponse.json({ error: '`leadsApiKey` must be a string' }, { status: 400 })
    }

    await saveOrgLeadsApiKey(supabase, orgId, payload.leadsApiKey?.trim() || null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/tochat/config] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const { orgId, supabase, error } = await requireOrgId()
    if (error) return error

    await disconnectOrgAccount(supabase, orgId)

    const status = await tochatStatusForOrg(supabase, orgId)
    return NextResponse.json({ connected: false, status })
  } catch (err) {
    console.error('[api/tochat/config] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
