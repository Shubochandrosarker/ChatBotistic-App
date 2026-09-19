import { NextResponse } from 'next/server'
import {
  createPluginToken,
  resolveOrgByLicenseKey,
  verifyLicenseWithServer,
} from '@/lib/plugin/session'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { parseJsonBody } from '@/lib/api/parse-json-body'

/**
 * POST /api/plugin/session
 *
 * License-key login for the Chatbotistic Widget WordPress plugin.
 *
 * Body: { license_key, site_url, plugin_version? }
 *
 * 1. Rate-limited per IP.
 * 2. The key is verified against the Licenseistic server on
 *    www.chatbotistic.com (server-to-server).
 * 3. The owning org is resolved via organizations.license_key — set
 *    by the SSO provisioner from the WP license claims.
 * 4. Returns { ok, token, expires_at, entitlements, org: { name, plan } }
 *    where `token` is the Bearer token for /api/plugin/widgets|stats.
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  const limit = checkRateLimit(`plugin-session:${ip}`, { limit: 10, windowMs: 10 * 60 * 1000 })
  if (!limit.success) return rateLimitResponse(limit)

  const { body: payload, error: parseError } = await parseJsonBody(request)
  if (parseError) return parseError
  const licenseKey = typeof payload.license_key === 'string' ? payload.license_key.trim() : ''
  const siteUrl = typeof payload.site_url === 'string' ? payload.site_url.trim() : ''
  if (!licenseKey || !siteUrl) {
    return NextResponse.json({ error: 'license_key and site_url are required' }, { status: 400 })
  }

  // 1. Server-side license check (entitlements + active status).
  const entitlements = await verifyLicenseWithServer(licenseKey)
  if (!entitlements) {
    return NextResponse.json(
      { success: false, message: 'Invalid or inactive license key.' },
      { status: 403 },
    )
  }

  // 2. Resolve the org that owns this license.
  const admin = supabaseAdmin()
  const orgId = await resolveOrgByLicenseKey(admin, licenseKey)
  if (!orgId) {
    return NextResponse.json(
      { success: false, message: 'No Chatbotistic workspace is linked to this license yet. Open the dashboard once (Members → Dashboard) to link it, then retry.' },
      { status: 404 },
    )
  }

  const { data: org } = await admin
    .from('organizations')
    .select('name, plan')
    .eq('id', orgId)
    .limit(1)
    .maybeSingle()

  // 3. Mint the bearer token.
  const { token, expiresAt } = createPluginToken(orgId, licenseKey)

  return NextResponse.json({
    ok: true,
    token,
    expires_at: expiresAt,
    entitlements,
    org: { name: org?.name ?? 'Workspace', plan: org?.plan ?? entitlements.plan },
    api_base: process.env.NEXT_PUBLIC_SITE_URL || 'https://app.chatbotistic.com',
  })
}

export const dynamic = 'force-dynamic'
