import { NextResponse } from 'next/server'
import { requireOrgId } from '@/lib/api/require-org-id'

/**
 * GET /api/licensing/status — the caller's org license state.
 *
 * Read through the RLS-scoped user client (policy: org members may
 * read their own row). The activation token / raw-key hash are NOT
 * selectable here and never leave the server.
 */
export async function GET() {
  const { orgId, supabase, error } = await requireOrgId()
  if (error) return error

  const { data } = await supabase
    .from('org_licenses')
    .select(
      'license_key_mask, status, product, plan, expires_at, last_checked_at, entitlements',
    )
    .eq('org_id', orgId)
    .maybeSingle()

  if (!data) {
    return NextResponse.json({ configured: false })
  }
  return NextResponse.json({ configured: true, ...data })
}

export const dynamic = 'force-dynamic'
