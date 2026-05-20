/**
 * Public SMS consent-capture endpoint.
 *
 * Backs the hosted opt-in form at /sms-optin/<widget_key>. Unlike the
 * authenticated /api/sms/consent endpoint this is called by the
 * tenant's own customers, so it takes no session — the tenant is
 * resolved from the public `widget_key` instead.
 *
 * It only ever *creates an opt-in*; it cannot read or modify anything
 * else, so the widget key is a public identifier rather than a secret.
 *
 * Body: { widget_key, phone, name?, age_confirmed }
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone, phonesMatch } from '@/lib/whatsapp/phone-utils'
import { setOptIn } from '@/lib/sms/compliance'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown'

    // Public endpoint — rate-limit by IP to deter abuse.
    const limit = checkRateLimit(`sms-optin:${ip}`, {
      limit: 10,
      windowMs: 60_000,
    })
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json()
    const { widget_key, phone, name, age_confirmed } = body

    if (!widget_key || typeof widget_key !== 'string') {
      return NextResponse.json({ error: 'Missing form key' }, { status: 400 })
    }
    if (age_confirmed !== true) {
      return NextResponse.json(
        { error: 'Age confirmation is required' },
        { status: 400 }
      )
    }

    const normalizedPhone = normalizePhone(String(phone ?? ''))
    if (normalizedPhone.replace(/\D/g, '').length < 10) {
      return NextResponse.json(
        { error: 'Enter a valid phone number including country code' },
        { status: 400 }
      )
    }

    // Resolve the tenant from the public widget key.
    const { data: config } = await supabaseAdmin()
      .from('whatsapp_config')
      .select('user_id')
      .eq('sms_widget_key', widget_key)
      .eq('provider', 'jasmin')
      .maybeSingle()

    if (!config) {
      return NextResponse.json(
        { error: 'This opt-in form is no longer active' },
        { status: 404 }
      )
    }
    const userId = config.user_id

    // Find or create the contact for this tenant.
    const { data: contacts } = await supabaseAdmin()
      .from('contacts')
      .select('id, phone, name')
      .eq('user_id', userId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contact = contacts?.find((c: any) =>
      phonesMatch(c.phone, normalizedPhone)
    )

    if (!contact) {
      const { data: created, error: createError } = await supabaseAdmin()
        .from('contacts')
        .insert({
          user_id: userId,
          phone: normalizedPhone,
          name: (typeof name === 'string' && name.trim()) || normalizedPhone,
        })
        .select('id')
        .single()
      if (createError || !created) {
        console.error('[sms-optin] contact create failed:', createError)
        return NextResponse.json(
          { error: 'Could not record your opt-in. Please try again.' },
          { status: 500 }
        )
      }
      contact = created
    }

    await setOptIn(supabaseAdmin(), userId, contact.id, {
      source: 'web_form',
      ip,
      ageConfirmed: true,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in public SMS consent POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
