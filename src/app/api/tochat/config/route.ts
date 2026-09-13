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
 * The config endpoint sends server-side credentials to the selected origin,
 * so only explicitly approved Tochat hosts may be configured.
 */
function approvedTochatHosts(): Set<string> {
  const configured = (process.env.TOCHAT_API_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
  return new Set(configured.length ? configured : ['services.tochat.be'])
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
        const host = parsed.hostname.toLowerCase()
        // Credentials are sent server-to-server. Do not allow an arbitrary
        // public origin here: that would turn this form into a credential
        // exfiltration endpoint. Staging can opt into an explicit host list.
        if (!approvedTochatHosts().has(host)) {
          return NextResponse.json({ error: '`apiBase` must be an approved Tochat host' }, { status: 400 })
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
