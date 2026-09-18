import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { requireOrgId } from '@/lib/api/require-org-id'
import { deactivateLicense, LicenseServerError } from '@/lib/licensing/wpistic-client'
import { loadStoredLicense, licenseErrorResponse } from '@/lib/licensing/service'

/**
 * POST /api/licensing/deactivate — release this org's license seat on
 * the WPistic license server and clear the local activation state.
 *
 * If the upstream activation no longer exists (already rotated /
 * released server-side → HTTP 404), we still clear local state so the
 * UI isn't stuck showing a license the server doesn't know about.
 */
export async function POST() {
  try {
    const { orgId, error } = await requireOrgId()
    if (error) return error

    const stored = await loadStoredLicense(orgId)
    if (!stored) {
      return NextResponse.json({ error: 'No activation found for this workspace.' }, { status: 404 })
    }

    try {
      if (stored.activationToken) {
        await deactivateLicense({
          activationToken: stored.activationToken,
          installationUuid: stored.installationUuid,
        })
      }
    } catch (err) {
      if (!(err instanceof LicenseServerError && err.status === 404)) throw err
    }

    const admin = supabaseAdmin()
    await admin.from('org_licenses').delete().eq('org_id', orgId)
    const { error: orgError } = await admin
      .from('organizations')
      .update({
        license_status: 'inactive',
        entitlements_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId)
    if (orgError) throw new Error(`Failed to reset license status: ${orgError.message}`)

    return NextResponse.json({ deactivated: true })
  } catch (err) {
    return licenseErrorResponse(err)
  }
}

export const dynamic = 'force-dynamic'
