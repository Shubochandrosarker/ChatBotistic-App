import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { verifyTochatLogin, TochatApiError } from '@/lib/tochat/client'
import { connectOrgAccount } from '@/lib/tochat/org-config'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { parseJsonBody } from '@/lib/api/parse-json-body'

/**
 * POST /api/auth/bridge-login
 *
 * One-form login for Chatbotistic customers whose account lives on
 * the tochat.be white-label backend (app.chatbotistic.com):
 *
 *   1. Verify email+password against the white-label API FIRST —
 *      bad credentials never touch our database.
 *   2. Ensure a Supabase auth user exists for that email (create
 *      with the SAME password when new) and sync the password on
 *      every bridge login, so the tochat password is always the
 *      authoritative one. No magic links, no email round-trip —
 *      works regardless of Supabase URL allowlist config.
 *   3. Ensure the org + owner membership exist (same provisioning
 *      path as signup: every user gets a personal workspace).
 *   4. Store the white-label credentials (AES-256-GCM encrypted) on
 *      the org — from then on every widget/operator/FAQ/booking call
 *      runs inside that customer's OWN tochat account, so they only
 *      ever see their own widgets (isolated mode — see
 *      src/lib/tochat/org-config.ts).
 *   5. Return { ok: true } — the client then signs in locally with
 *      supabase.auth.signInWithPassword (the credentials it already
 *      has in memory) and routes to /dashboard.
 *
 * Body: { email, password }
 */

const LOGIN_RATE_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 } // 10 tries / 10 min / IP

export async function POST(request: Request) {
  try {
    // Bracket the IP from x-forwarded-for (Cloudflare → Passenger).
    const ip =
      request.headers.get('cf-connecting-ip') ||
      (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
      'unknown'
    const limit = checkRateLimit(`bridge-login:${ip}`, LOGIN_RATE_LIMIT)
    if (!limit.success) return rateLimitResponse(limit)

    const { body: payload, error: parseError } = await parseJsonBody(request)
    if (parseError) return parseError
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    const password = typeof payload.password === 'string' ? payload.password : ''
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 },
      )
    }

    // 1. Credentials are verified upstream FIRST.
    try {
      await verifyTochatLogin(email, password)
    } catch (err) {
      if (err instanceof TochatApiError && err.status === 401) {
        return NextResponse.json(
          { error: 'Invalid email or password.' },
          { status: 401 },
        )
      }
      throw err
    }

    const admin = supabaseAdmin()

    // 2. Resolve the mirror user — profiles lookup first (indexed,
    // avoids paging the whole auth user list), fallback to listUsers.
    let userId: string | null = null
    const { data: profile } = await admin
      .from('profiles')
      .select('user_id')
      .eq('email', email)
      .limit(1)
      .maybeSingle()
    if (profile?.user_id) {
      userId = profile.user_id as string
    } else {
      const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      userId =
        (listData?.users ?? []).find((u) => (u.email ?? '').toLowerCase() === email)?.id ??
        null
    }

    if (userId) {
      // Keep the mirror password in sync with the authoritative
      // (tochat) one the user just proved.
      const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password })
      if (updateError) {
        console.error('[bridge-login] password sync failed:', updateError.message)
        // Non-fatal — the user may still sign in with their previous
        // CRM password; org + account connection below still run.
      }
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password,
        user_metadata: { full_name: email.split('@')[0], bridge: 'tochat' },
      })
      if (createError || !created?.user) {
        console.error('[bridge-login] createUser failed:', createError?.message)
        return NextResponse.json(
          { error: 'Could not create your account. Try again.' },
          { status: 500 },
        )
      }
      userId = created.user.id
    }

    // 3. Ensure org + membership (mirrors handle_new_user for signups).
    let orgId: string | null = null
    const { data: membership } = await admin
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (membership?.org_id) {
      orgId = membership.org_id as string
    } else {
      const { data: org, error: orgError } = await admin
        .from('organizations')
        .insert({
          name: `${email.split('@')[0]}'s workspace`,
          plan: 'free',
          sso_subject: `tochat:${email}`,
        })
        .select('id')
        .single()
      if (orgError || !org) {
        console.error('[bridge-login] org insert failed:', orgError?.message)
        return NextResponse.json({ error: 'Could not provision your workspace.' }, { status: 500 })
      }
      orgId = org.id as string
      await admin
        .from('org_members')
        .upsert(
          { org_id: orgId, user_id: userId, role: 'owner', is_primary: true },
          { onConflict: 'org_id,user_id' },
        )
    }

    // 4. Persist the verified white-label credentials for the org.
    try {
      await connectOrgAccount(admin, orgId, email, password, null)
    } catch (err) {
      // Login still succeeds if persistence hiccups — the org can
      // reconnect from Settings → Chatbotistic.
      console.error('[bridge-login] connectOrgAccount failed:', (err as Error).message)
    }

    // 5. Client signs in locally with the credentials it already has.
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[bridge-login] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
