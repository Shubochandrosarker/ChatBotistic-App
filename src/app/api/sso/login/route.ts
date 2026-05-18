import { NextRequest, NextResponse } from 'next/server'
import { verifySsoToken, SsoTokenError } from '@/lib/sso/token'
import { provisionFromClaims } from '@/lib/sso/provision'
import { supabaseAdmin } from '@/lib/automations/admin-client'

/**
 * GET /api/sso/login?token=<sso-token>
 *
 * Entry point for the Memberistic + Licenseistic SSO bridge. The
 * WordPress plugins redirect the browser here with a short-lived,
 * HMAC-signed token. This route:
 *
 *   1. Verifies the token signature + freshness.
 *   2. Ensures a Supabase auth user exists for the asserted email.
 *   3. Upserts the organization (keyed by the WordPress subject) and
 *      writes the latest entitlements (plan, license, agent/widget/
 *      domain limits, allowed domains) onto it.
 *   4. Ensures the user is an owner member of that org.
 *   5. Redirects the browser through Supabase's magic-link verifier,
 *      which sets the session cookie and lands on /dashboard.
 *
 * Every failure short-circuits with a clear status — a bad token
 * never results in a partially provisioned login.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'Missing SSO token' }, { status: 400 })
  }

  const secret = process.env.SSO_SHARED_SECRET
  if (!secret) {
    console.error('[sso/login] SSO_SHARED_SECRET is not configured')
    return NextResponse.json(
      { error: 'SSO is not configured on this deployment' },
      { status: 500 },
    )
  }
  const maxSkew = Number(process.env.SSO_MAX_SKEW_SECONDS ?? 300)

  let claims
  try {
    claims = verifySsoToken(token, secret, maxSkew)
  } catch (err) {
    if (err instanceof SsoTokenError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    throw err
  }

  const admin = supabaseAdmin()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
  const redirectTo = `${siteUrl.replace(/\/$/, '')}/dashboard`

  // Ensure the auth user exists. createUser fails loudly only on real
  // errors — an "already registered" message is the expected path for
  // a returning user and is treated as success.
  const { error: createError } = await admin.auth.admin.createUser({
    email: claims.email,
    email_confirm: true,
    user_metadata: { full_name: claims.name ?? '' },
  })
  if (createError && !/already|registered|exists/i.test(createError.message)) {
    console.error('[sso/login] createUser failed:', createError.message)
    return NextResponse.json(
      { error: `Failed to provision user: ${createError.message}` },
      { status: 500 },
    )
  }

  // The magic link both resolves the user id and bootstraps the
  // browser session when followed.
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: claims.email,
      options: { redirectTo },
    })
  if (linkError || !linkData?.user || !linkData.properties?.action_link) {
    console.error('[sso/login] generateLink failed:', linkError?.message)
    return NextResponse.json(
      { error: `Failed to start session: ${linkError?.message ?? 'unknown error'}` },
      { status: 500 },
    )
  }

  try {
    await provisionFromClaims(admin, linkData.user.id, claims)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Provisioning failed'
    console.error('[sso/login] provisioning failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.redirect(linkData.properties.action_link)
}
