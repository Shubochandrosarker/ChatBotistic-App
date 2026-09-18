import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { requireOrgId } from '@/lib/api/require-org-id'
import { parseJsonBody } from '@/lib/api/parse-json-body'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import {
  activateLicense,
  validateLicense,
  deterministicInstallationUuid,
  maskLicenseKey,
  hashLicenseKey,
} from '@/lib/licensing/wpistic-client'
import {
  persistLicenseResult,
  loadStoredLicense,
  licenseErrorResponse,
} from '@/lib/licensing/service'

/**
 * POST /api/licensing/activate — activate a Chatbotistic license key
 * from the WPistic license server for the caller's org.
 *
 * Body: { key: string }
 * Flow: license server POST /activate (key + crm domain + stable
 * installation UUID) → persist activation (encrypted token) → sync
 * plan/limits onto organizations → return the sanitized result.
 */

const ACTIVATE_RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 }

export async function POST(request: Request) {
  try {
    const { orgId, error: orgError } = await requireOrgId()
    if (orgError) return orgError

    const limit = checkRateLimit(`license-activate:${orgId}`, ACTIVATE_RATE_LIMIT)
    if (!limit.success) return rateLimitResponse(limit)

    const { body, error: parseError } = await parseJsonBody(request)
    if (parseError) return parseError
    const key = typeof body.key === 'string' ? body.key.trim() : ''
    if (key.length < 12 || key.length > 120) {
      return NextResponse.json(
        { error: 'That does not look like a license key.' },
        { status: 400 },
      )
    }

    const domain = process.env.LICENSE_ACTIVATION_DOMAIN || 'crm.chatbotistic.com'
    const installationUuid = deterministicInstallationUuid(orgId)

    const result = await activateLicense({
      key,
      domain,
      installationUuid,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || `https://${domain}`,
      productVersion: 'crm-1.0.0',
    })

    await persistLicenseResult(orgId, domain, result, {
      licenseKeyMask: maskLicenseKey(key),
      licenseKeyHash: hashLicenseKey(key),
      activationToken: result.activation_token,
    })

    return NextResponse.json({
      valid: result.valid,
      status: result.status,
      plan: result.plan,
      product: result.product,
      expires_at: result.expires_at,
      license_key_mask: maskLicenseKey(key),
    })
  } catch (err) {
    return licenseErrorResponse(err)
  }
}

/** GET is not part of activate — see /api/licensing/status. */
export const dynamic = 'force-dynamic'

// Re-validate immediately after activation once so `last_checked_at`
// reflects a real /validate round-trip too. Cheap (one extra call) and
// proves the token works before the user leaves the settings page.
export async function PUT(request: Request) {
  try {
    const { orgId, error: orgError } = await requireOrgId()
    if (orgError) return orgError

    const stored = await loadStoredLicense(orgId)
    if (!stored?.activationToken) {
      return NextResponse.json(
        { error: 'No stored activation to validate. Activate a license first.' },
        { status: 404 },
      )
    }

    const result = await validateLicense({
      activationToken: stored.activationToken,
      domain: stored.domain,
      installationUuid: stored.installationUuid,
    })

    await persistLicenseResult(orgId, stored.domain, result, {
      licenseKeyMask: '', // preserved — re-validation has no raw key
      activationToken: result.activation_token ?? stored.activationToken,
    })

    // Refetch the persisted mask so the response shows what the user
    // last activated (persistLicenseResult kept it).
    const { data: row } = await supabaseAdmin()
      .from('org_licenses')
      .select('license_key_mask, plan')
      .eq('org_id', orgId)
      .maybeSingle()

    return NextResponse.json({
      valid: result.valid,
      status: result.status,
      plan: result.plan,
      expires_at: result.expires_at,
      license_key_mask: row?.license_key_mask ?? '',
    })
  } catch (err) {
    return licenseErrorResponse(err)
  }
}
