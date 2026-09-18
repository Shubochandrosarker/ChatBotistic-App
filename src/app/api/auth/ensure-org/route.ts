import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'

/**
 * POST /api/auth/ensure-org
 *
 * Belt-and-braces companion to migration 021: after ANY login path
 * (email signup, password login, magic link), make sure the user owns
 * an organization. Without an org every dashboard API call 404s
 * ("No organization for this account").
 *
 * Called fire-and-forget from the dashboard shell on mount. If the
 * user already has an org this is a single indexed lookup.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const { data: membership } = await admin
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (membership?.org_id) {
    return NextResponse.json({ ensured: false, orgId: membership.org_id })
  }

  const email = user.email ?? `${user.id}@unknown.local`
  const { data: profileName } = await admin
    .from('profiles')
    .select('full_name')
    .eq('user_id', user.id)
    .maybeSingle()
  const name =
    (profileName?.full_name as string | undefined)?.trim() ||
    `${email.split('@')[0]}'s workspace`

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name, plan: 'free' })
    .select('id')
    .single()
  if (orgError || !org) {
    console.error('[ensure-org] insert failed:', orgError?.message)
    return NextResponse.json({ error: 'Could not create your workspace.' }, { status: 500 })
  }

  const { error: memberError } = await admin.from('org_members').upsert(
    { org_id: org.id, user_id: user.id, role: 'owner', is_primary: true },
    { onConflict: 'org_id,user_id' },
  )
  if (memberError) {
    console.error('[ensure-org] membership failed:', memberError.message)
    return NextResponse.json({ error: 'Could not set workspace membership.' }, { status: 500 })
  }

  return NextResponse.json({ ensured: true, orgId: org.id })
}

export const dynamic = 'force-dynamic'
