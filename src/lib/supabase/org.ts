import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolve the calling user's org id via an RLS-scoped client (i.e. one
 * created with `createClient()` from `./server`, carrying the user's
 * session). `organizations` SELECT is already restricted by RLS to
 * orgs the caller belongs to (see `user_org_ids()` in
 * supabase/migrations/009_org_tenancy.sql), so this just picks one —
 * it is not itself a trust boundary.
 */
export async function resolveOrgId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from('organizations').select('id').limit(1).maybeSingle()
  return (data?.id as string | undefined) ?? null
}

/**
 * Resolve a user's primary org id via a service-role (RLS-bypassing)
 * client, given only their user id — for contexts that only have a
 * `user_id` on hand (webhooks, the automation engine) and need the org
 * to scope an admin-client query correctly. Mirrors the
 * `user_primary_org()` Postgres function 1:1 (same ordering), since
 * that function can't be called from an admin client's query builder.
 */
export async function primaryOrgIdForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data?.org_id as string | undefined) ?? null
}
