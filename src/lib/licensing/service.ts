// ------------------------------------------------------------
// Shared helpers for /api/licensing/* routes.
// ------------------------------------------------------------

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import {
  deterministicInstallationUuid,
  LicenseServerError,
  type LicenseServerResult,
} from '@/lib/licensing/wpistic-client'

/** Entitlement keys the license server may send that map onto the
 *  organizations columns the app enforces at create-time. */
const ENTITLEMENT_TO_COLUMN: Record<string, string> = {
  widget_limit: 'widget_limit',
  agent_limit: 'agent_limit',
  domain_limit: 'domain_limit',
  contact_limit: 'contact_limit',
}

function clampLimit(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value)
  }
  return fallback
}

/** Map a license-server status onto organizations.license_status
 *  (which has a CHECK constraint without the grace variants). */
export function orgLicenseStatus(status: string): string {
  switch (status) {
    case 'active':
    case 'grace_period':
      return 'active'
    case 'expired':
      return 'expired'
    case 'suspended':
    case 'activation_suspended':
      return 'suspended'
    default:
      return 'inactive'
  }
}

export interface StoredLicense {
  orgId: string
  domain: string
  installationUuid: string
  activationToken: string | null
  licenseKeyHash: string | null
}

/** Load the stored activation for an org (service role — the token is
 *  sensitive and RLS blocks client reads of the token column anyway). */
export function loadStoredLicense(orgId: string): Promise<StoredLicense | null> {
  return (async () => {
    const admin = supabaseAdmin()
    const { data } = await admin
      .from('org_licenses')
      .select('org_id, activation_domain, activation_token_encrypted, license_key_hash')
      .eq('org_id', orgId)
      .maybeSingle()
    if (!data) return null
    let activationToken: string | null = null
    if (data.activation_token_encrypted) {
      try {
        activationToken = decrypt(data.activation_token_encrypted)
      } catch {
        activationToken = null
      }
    }
    return {
      orgId,
      domain: (data.activation_domain as string) || 'crm.chatbotistic.com',
      installationUuid: deterministicInstallationUuid(orgId),
      activationToken,
      licenseKeyHash: (data.license_key_hash as string) || null,
    }
  })()
}

/** Persist an activation/validation result + sync entitlements onto
 *  organizations so the existing enforcement paths pick them up. */
export async function persistLicenseResult(
  orgId: string,
  domain: string,
  result: LicenseServerResult,
  extras: {
    licenseKeyMask: string
    licenseKeyHash?: string
    activationToken: string | null
  },
): Promise<void> {
  const admin = supabaseAdmin()

  const update: Record<string, unknown> = {
    status: orgLicenseStatus(result.status),
    product: result.product,
    plan: result.plan,
    expires_at: result.expires_at,
    activation_domain: domain,
    entitlements: result.entitlements,
    last_checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  // An empty mask means "re-validation, keep the existing value" —
  // the raw key is unavailable on that path by design.
  if (extras.licenseKeyMask) update.license_key_mask = extras.licenseKeyMask
  if (extras.licenseKeyHash) update.license_key_hash = extras.licenseKeyHash
  if (extras.activationToken) {
    update.activation_token_encrypted = encrypt(extras.activationToken)
  }

  const { error } = await admin.from('org_licenses').upsert(
    { org_id: orgId, ...update },
    { onConflict: 'org_id' },
  )
  if (error) throw new Error(`Failed to save the license state: ${error.message}`)

  // Mirror plan + limits onto organizations so widget/agent creation
  // limits (src/lib/tochat/entitlements.ts) and SSO-style rendering
  // reflect the activated license without a redeploy.
  const orgUpdate: Record<string, unknown> = {
    license_status: orgLicenseStatus(result.status),
    entitlements_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  if (result.plan && result.plan !== 'free') orgUpdate.plan = result.plan
  for (const [key, column] of Object.entries(ENTITLEMENT_TO_COLUMN)) {
    if (key in result.entitlements) {
      const fallback = column === 'contact_limit' ? 50 : 1
      orgUpdate[column] = clampLimit(result.entitlements[key], fallback)
    }
  }

  const { error: orgError } = await admin
    .from('organizations')
    .update(orgUpdate)
    .eq('id', orgId)
  if (orgError) throw new Error(`Failed to sync entitlements: ${orgError.message}`)
}

/** Standard error shape for license routes. */
export function licenseErrorResponse(err: unknown): NextResponse {
  if (err instanceof LicenseServerError) {
    return NextResponse.json({ error: err.message }, { status: err.status >= 400 && err.status < 500 ? err.status : 502 })
  }
  console.error('[licensing] unexpected error:', err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
