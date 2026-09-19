// License-key authentication for the Chatbotistic Widget WordPress
// plugin (/api/plugin/* routes).
//
// Flow:
//   1. The plugin POSTs its license key + site URL to
//      /api/plugin/session.
//   2. We verify the key against the Licenseistic server on
//      www.chatbotistic.com (server-to-server) — the key must be
//      active there.
//   3. We resolve the owning organization: organizations.license_key
//      (written by the SSO provisioner when the WP license claims
//      ride the SSO token).
//   4. We mint a short-lived HMAC token (org + license + exp, signed
//      with CHATBOTISTIC_API_KEY) that the plugin sends as a Bearer
//      token on /api/plugin/widgets and /api/plugin/stats.
//
// No user credentials ever touch the plugin; the license key is the
// only secret the customer manages.

import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const TOKEN_TTL_SECONDS = 14 * 24 * 60 * 60 // 14 days — refreshed on every 12h plugin heartbeat
const WP_LICENSE_ENDPOINT =
  process.env.WP_LICENSE_ENDPOINT ||
  'https://www.chatbotistic.com/wp-json/licenseistic/v1/entitlements'

export interface PluginEntitlements {
  plan: string
  plan_name: string
  max_widgets: number
  max_agents: number
  max_domains: number
  white_label: boolean
  branding: boolean
}

function hmacSecret(): string {
  const secret = process.env.CHATBOTISTIC_API_KEY || ''
  if (!secret) throw new Error('CHATBOTISTIC_API_KEY is not configured')
  return secret
}

/** Verify a license key against the WP Licenseistic server. */
export async function verifyLicenseWithServer(
  licenseKey: string,
): Promise<PluginEntitlements | null> {
  const url = new URL(WP_LICENSE_ENDPOINT)
  url.searchParams.set('license_key', licenseKey)
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'ChatbotisticPlugin/1.5.0 (+https://app.chatbotistic.com)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      success?: boolean
      data?: {
        plan?: string
        plan_name?: string
        entitlements?: Record<string, unknown>
      }
    }
    if (!json?.success) return null
    const d = json.data ?? {}
    const ent = d.entitlements ?? {}
    return {
      plan: String(d.plan ?? 'free'),
      plan_name: String(d.plan_name ?? 'Free'),
      max_widgets: Number(ent.max_widgets ?? 1),
      max_agents: Number(ent.max_agents ?? 1),
      max_domains: Number(ent.max_domains ?? 1),
      white_label: Boolean(ent.white_label),
      branding: ent.branding !== false,
    }
  } catch {
    return null
  }
}

/**
 * Resolve the organization that owns a license key.
 * organizations.license_key is the canonical link (SSO provisioner).
 */
export async function resolveOrgByLicenseKey(
  supabase: SupabaseClient,
  licenseKey: string,
): Promise<string | null> {
  const plain = licenseKey.trim()
  const { data: org, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('license_key', plain)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[plugin/session] org lookup failed:', error.message)
    return null
  }
  return (org?.id as string) ?? null
}

export function createPluginToken(
  orgId: string,
  licenseKey: string,
): { token: string; expiresAt: number } {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  const payload = Buffer.from(
    JSON.stringify({ org: orgId, lic: licenseKey, exp }),
    'utf8',
  ).toString('base64url')
  const sig = crypto
    .createHmac('sha256', hmacSecret())
    .update(payload)
    .digest('base64url')
  return { token: `${payload}.${sig}`, expiresAt: exp }
}

export function verifyPluginToken(
  token: string | null,
): { orgId: string; licenseKey: string } | null {
  if (!token || !token.includes('.')) return null
  const [payload, sig] = token.split('.')
  const expected = crypto
    .createHmac('sha256', hmacSecret())
    .update(payload)
    .digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      org?: string
      lic?: string
      exp?: number
    }
    if (typeof claims.exp !== 'number' || Math.floor(Date.now() / 1000) > claims.exp)
      return null
    if (!claims.org || !claims.lic) return null
    return { orgId: claims.org, licenseKey: claims.lic }
  } catch {
    return null
  }
}
