// Plan-entitlement helpers for the white-label resources. The SSO
// bridge (src/lib/sso/provision.ts) writes widget_limit / agent_limit
// onto `organizations`; these are enforced at creation time here.
//
// Limit semantics (mirrors the WordPress bridge caps): null or any
// negative value = unlimited.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface OrgEntitlements {
  plan: string | null
  license_status: string | null
  widget_limit: number | null
  agent_limit: number | null
}

export async function orgEntitlements(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OrgEntitlements> {
  const { data, error } = await supabase
    .from('organizations')
    .select('plan, license_status, widget_limit, agent_limit')
    .eq('id', orgId)
    .maybeSingle()
  if (error || !data) {
    // Entitlement lookup failing must never widen access — treat as
    // the most restrictive known default rather than unlimited.
    console.error(`[tochat] entitlement lookup failed for org ${orgId}:`, error?.message)
    return { plan: null, license_status: null, widget_limit: 1, agent_limit: 1 }
  }
  return {
    plan: (data.plan as string | null) ?? null,
    license_status: (data.license_status as string | null) ?? null,
    widget_limit: data.widget_limit ?? null,
    agent_limit: data.agent_limit ?? null,
  }
}

/** null/negative = unlimited; otherwise true when count >= limit. */
export function limitReached(limit: number | null | undefined, count: number): boolean {
  if (limit == null || limit < 0) return false
  return count >= limit
}
