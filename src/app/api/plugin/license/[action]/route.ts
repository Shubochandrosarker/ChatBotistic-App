import { NextResponse } from 'next/server'
import {
  createPluginToken,
  verifyPluginToken,
  verifyLicenseWithServer,
} from '@/lib/plugin/session'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { parseJsonBody } from '@/lib/api/parse-json-body'

/**
 * License protocol front for the Chatbotistic Widget WordPress plugin.
 *
 * The plugin (class-license.php) POSTs here with its native envelope:
 *   { key, site_url, home_url, domain, installation_uuid, plugin_version, ... }
 * and expects:
 *   { success|ok, activation_token, data: { plan, plan_name, entitlements } }
 *
 * Under the hood we:
 *   1. Register the activation with the Licenseistic server on
 *      www.chatbotistic.com (source of truth for key status, caps and
 *      activation limits).
 *   2. Mint our own stateless HMAC activation token the plugin uses
 *      for heartbeats + the analytics API.
 */

const LSI_BASE =
  process.env.WP_LICENSE_BASE || 'https://www.chatbotistic.com/wp-json/licenseistic/v1'

async function lsi(path: string, body: Record<string, unknown>, method: 'POST' | 'GET' = 'POST') {
  const url = new URL(LSI_BASE + path)
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'ChatbotisticPlugin/1.5.0 (+https://app.chatbotistic.com)',
    },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  }
  if (method === 'POST') {
    init.body = JSON.stringify(body)
  } else {
    for (const [k, v] of Object.entries(body)) url.searchParams.set(k, String(v))
  }
  const res = await fetch(url, init)
  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; message?: string; data?: Record<string, unknown> }
    | null
  return { status: res.status, ok: res.ok && !!json?.success, json }
}

function entitlementEnvelope(ent: {
  plan: string
  plan_name: string
  max_widgets: number
  max_agents: number
  max_domains: number
  white_label: boolean
  branding: boolean
}) {
  return {
    plan: ent.plan,
    tier: ent.plan,
    plan_name: ent.plan_name,
    status: 'active',
    valid: true,
    expires_at: '',
    activation_limit: ent.max_domains,
    entitlements: {
      max_widgets: ent.max_widgets,
      max_agents: ent.max_agents,
      max_domains: ent.max_domains,
      white_label: ent.white_label,
      branding: ent.branding,
    },
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action: routeAction } = await params
  const ip =
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  const limit = checkRateLimit(`plugin-license:${ip}`, { limit: 20, windowMs: 10 * 60 * 1000 })
  if (!limit.success) return rateLimitResponse(limit)

  const { body: p, error: parseError } = await parseJsonBody(request)
  if (parseError) return parseError

  const action = routeAction
  const licenseKey = String(p.key ?? p.license_key ?? '').trim()
  const siteUrl = String(p.site_url ?? p.home_url ?? '').trim()
  const instanceId = String(p.installation_uuid ?? p.instance_id ?? '').trim()

  if (action === 'activate') {
    if (!licenseKey || !siteUrl) {
      return NextResponse.json(
        { success: false, message: 'license key and site_url are required' },
        { status: 400 },
      )
    }
    // 1. Licenseistic activation (enforces activation_limit per domain).
    const act = await lsi('/activate', {
      license_key: licenseKey,
      site_url: siteUrl,
      instance_id: instanceId,
    })
    if (!act.ok) {
      return NextResponse.json(
        {
          success: false,
          message: act.json?.message ?? 'License could not be activated.',
        },
        { status: 403 },
      )
    }
    // 2. Caps from Licenseistic entitlements.
    const ent = await verifyLicenseWithServer(licenseKey)
    if (!ent) {
      return NextResponse.json(
        { success: false, message: 'License is no longer active.' },
        { status: 403 },
      )
    }
    // 3. Resolve org for analytics (soft requirement).
    let orgId: string | null = null
    try {
      const { resolveOrgByLicenseKey } = await import('@/lib/plugin/session')
      const { supabaseAdmin } = await import('@/lib/automations/admin-client')
      orgId = await resolveOrgByLicenseKey(supabaseAdmin(), licenseKey)
    } catch (err) {
      console.error('[plugin/license] org resolve failed:', err)
    }
    if (!orgId) {
      return NextResponse.json(
        {
          success: false,
          message:
            'No Chatbotistic workspace is linked to this license yet. Open your dashboard once from the account page, then retry.',
        },
        { status: 404 },
      )
    }

    const { token } = createPluginToken(orgId, licenseKey)
    return NextResponse.json({
      success: true,
      ok: true,
      message: 'License activated.',
      activation_token: token,
      customer_email: '',
      data: entitlementEnvelope(ent),
    })
  }

  if (action === 'validate' || action === 'heartbeat') {
    const token = String(p.activation_token ?? '').trim()
    const auth = verifyPluginToken(token)
    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired installation token. Please reactivate.' },
        { status: 401 },
      )
    }
    // Re-verify key status (Licenseistic).
    const ent = await verifyLicenseWithServer(auth.licenseKey)
    if (!ent) {
      return NextResponse.json({ success: false, message: 'License is inactive.' }, { status: 403 })
    }
    // Rolling refresh: mint a FRESH installation token on every heartbeat
    // so a healthy install's token never ages past the TTL.
    const fresh = createPluginToken(auth.orgId, auth.licenseKey)
    return NextResponse.json({
      success: true,
      ok: true,
      valid: true,
      message: 'License is valid.',
      activation_token: fresh.token,
      data: entitlementEnvelope(ent),
    })
  }

  if (action === 'deactivate') {
    const token = String(p.activation_token ?? '').trim()
    const licenseKeyFallback = String(p.key ?? p.license_key ?? '').trim()
    const auth = verifyPluginToken(token)
    const key = auth?.licenseKey ?? licenseKeyFallback
    if (!key || !siteUrl) {
      return NextResponse.json({ success: false, message: 'Nothing to deactivate.' }, { status: 400 })
    }
    const act = await lsi('/deactivate', {
      license_key: key,
      site_url: siteUrl,
      instance_id: instanceId,
    })
    return NextResponse.json({
      success: true,
      ok: true,
      message: 'License deactivated.',
    })
  }

  return NextResponse.json({ success: false, message: 'Unknown action.' }, { status: 400 })
}

export const dynamic = 'force-dynamic'
