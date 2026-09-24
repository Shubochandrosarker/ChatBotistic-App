/**
 * Apply verified SSO claims to the database: upsert the organization
 * keyed by `sso_subject`, write the Memberistic/Licenseistic
 * entitlements onto it, and make sure the user is an owner member.
 *
 * Takes a service-role Supabase client (RLS-bypassing) because it
 * provisions rows before the user has a session.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SsoClaims } from './token'

export interface ProvisionResult {
  orgId: string
}

export async function provisionFromClaims(
  admin: SupabaseClient,
  userId: string,
  claims: SsoClaims,
): Promise<ProvisionResult> {
  const entitlements = {
    name: claims.name?.trim() || claims.email,
    plan: claims.plan || 'free',
    license_key: claims.license_key ?? null,
    license_status: claims.license_status ?? 'inactive',
    agent_limit: clampInt(claims.agent_limit, 1),
    widget_limit: clampInt(claims.widget_limit, 1),
    domain_limit: clampInt(claims.domain_limit, 1),
    // 0 is valid here — it means "unlimited".
    contact_limit: clampInt(claims.contact_limit, 50),
    seat_limit: clampInt(claims.seat_limit, 1),
    message_limit: clampInt(claims.message_limit, 100),
    white_label: claims.white_label === true,
    allowed_domains: normalizeDomains(claims.allowed_domains),
    entitlements_synced_at: new Date().toISOString(),
  }

  // Upsert the org on the stable WordPress subject. On a returning
  // login this refreshes the entitlements to the latest assertion.
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .upsert(
      { sso_subject: claims.sub, ...entitlements },
      { onConflict: 'sso_subject' },
    )
    .select('id')
    .single()

  if (orgError || !org) {
    throw new Error(
      `Failed to provision organization: ${orgError?.message ?? 'unknown error'}`,
    )
  }

  // Ensure the user is an owner of the org. A second login from a
  // different CRM user under the same WordPress subject joins the
  // same org rather than creating a duplicate.
  const { error: memberError } = await admin.from('org_members').upsert(
    { org_id: org.id, user_id: userId, role: 'owner', is_primary: true },
    { onConflict: 'org_id,user_id' },
  )

  if (memberError) {
    throw new Error(`Failed to attach user to organization: ${memberError.message}`)
  }

  // Seed the white-label tenancy tag: WordPress subjects (wp-{id})
  // inherit the connector's cbc-{id} tag so widgets created in the
  // member portal are visible in this dashboard under the shared
  // master account. Never overwrites an existing tag (migration 020).
  const { error: tagError } = await admin.from('tochat_org_config').upsert(
    {
      org_id: org.id,
      user_client: claims.sub.startsWith('wp-')
        ? `cbc-${claims.sub.slice(3)}`
        : `org-${org.id}`,
    },
    { onConflict: 'org_id', ignoreDuplicates: true },
  )
  if (tagError) {
    // Non-fatal: a missing tag row falls back to the deterministic
    // org-{id} default at read time. Logged, never thrown.
    console.error('[sso] failed to seed tochat tenancy tag:', tagError.message)
  }

  return { orgId: org.id }
}

function clampInt(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  // -1 is the bridge's explicit "unlimited" sentinel (matching
  // limitReached semantics in entitlements.ts). Any other negative is
  // malformed data and must fall back, never widen.
  if (value === -1) return -1
  if (value < 0) return fallback
  return Math.floor(value)
}

function normalizeDomains(domains: string[] | undefined): string[] {
  if (!Array.isArray(domains)) return []
  return Array.from(
    new Set(
      domains
        .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, ''))
        .filter(Boolean),
    ),
  )
}
