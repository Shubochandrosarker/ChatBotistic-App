import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/supabase/org'

/**
 * Auth + org resolution for API routes that need both. Returns a
 * ready-to-return NextResponse on failure so callers can just
 * `if (error) return error`.
 */
export async function requireOrgId(): Promise<
  { orgId: string; error: null } | { orgId: null; error: NextResponse }
> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { orgId: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const orgId = await resolveOrgId(supabase)
  if (!orgId) {
    return {
      orgId: null,
      error: NextResponse.json({ error: 'No organization for this account' }, { status: 404 }),
    }
  }

  return { orgId, error: null }
}
