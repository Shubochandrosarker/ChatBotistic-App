/**
 * SMS consent endpoint.
 *
 * Lets a tenant record and read a contact's SMS opt-in / opt-out state
 * — the express-consent evidence the send route requires before any
 * SMS goes out. Typically called from the CRM UI after consent is
 * collected on a web form or at the point of sale.
 *
 *   GET  /api/sms/consent?contact_id=...   → current consent record
 *   POST /api/sms/consent                  → record opt-in / opt-out
 *        body: { contact_id, status: 'opted_in' | 'opted_out',
<<<<<<< HEAD
 *                source?, age_confirmed? }
=======
 *                source?, age_confirmed?, legal_text_version? }
>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConsent, setOptIn, setOptOut } from '@/lib/sms/compliance'

async function authedUserAndContact(request: Request, contactId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized', status: 401 as const }

  if (!contactId) {
    return { error: 'contact_id is required', status: 400 as const }
  }

  // Confirm the contact belongs to this user before touching consent.
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contact) return { error: 'Contact not found', status: 404 as const }

  return { supabase, userId: user.id }
}

export async function GET(request: Request) {
  try {
    const contactId = new URL(request.url).searchParams.get('contact_id') ?? ''
    const auth = await authedUserAndContact(request, contactId)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const consent = await getConsent(auth.supabase, contactId)
    return NextResponse.json({
      consent: consent ?? { status: 'pending', age_confirmed: false },
    })
  } catch (error) {
    console.error('Error in SMS consent GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
<<<<<<< HEAD
    const { contact_id, status, source, age_confirmed } = body
=======
    const { contact_id, status, source, age_confirmed, legal_text_version } = body
>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)

    const auth = await authedUserAndContact(request, contact_id)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    if (status !== 'opted_in' && status !== 'opted_out') {
      return NextResponse.json(
        { error: "status must be 'opted_in' or 'opted_out'" },
        { status: 400 }
      )
    }

    if (status === 'opted_out') {
<<<<<<< HEAD
      await setOptOut(auth.supabase, auth.userId, contact_id)
    } else {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
      await setOptIn(auth.supabase, auth.userId, contact_id, {
        source: typeof source === 'string' ? source : 'web_form',
        ip: ip ?? undefined,
        ageConfirmed: age_confirmed === true,
=======
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
      const userAgent = request.headers.get('user-agent')
      await setOptOut(auth.supabase, auth.userId, contact_id, {
        source: typeof source === 'string' ? source : 'manual',
        ip: ip ?? undefined,
        userAgent: userAgent ?? undefined,
      })
    } else {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
      const userAgent = request.headers.get('user-agent')
      await setOptIn(auth.supabase, auth.userId, contact_id, {
        source: typeof source === 'string' ? source : 'web_form',
        ip: ip ?? undefined,
        userAgent: userAgent ?? undefined,
        ageConfirmed: age_confirmed === true,
        legalTextVersion:
          typeof legal_text_version === 'string' ? legal_text_version : undefined,
>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)
      })
    }

    const consent = await getConsent(auth.supabase, contact_id)
    return NextResponse.json({ success: true, consent })
  } catch (error) {
    console.error('Error in SMS consent POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
