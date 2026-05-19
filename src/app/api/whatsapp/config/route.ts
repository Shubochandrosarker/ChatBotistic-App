import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/whatsapp/encryption'
import { providerFromConfigRow } from '@/lib/whatsapp/load-provider'
import { createWhatsAppProvider } from '@/lib/whatsapp/provider'
import type { ConnectionInfo } from '@/lib/whatsapp/provider'

/**
 * GET /api/whatsapp/config
 *
 * Health check for the saved config. Works for both providers: it
 * resolves the org's provider (Meta or Twilio) from the row and probes
 * the live credentials. Returns 200 in all non-auth cases so the UI can
 * render a message rather than a 500.
 *
 * Response shape:
 *   { connected: true,  provider, phone_info: { verified_name, display_phone_number } }
 *   { connected: false, reason: 'no_config',       message }
 *   { connected: false, reason: 'token_corrupted', message, needs_reset: true }
 *   { connected: false, reason: 'provider_error',  message }
 */
function toPhoneInfo(info: ConnectionInfo) {
  return {
    verified_name: info.displayName ?? null,
    display_phone_number: info.phoneNumber ?? null,
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (configError) {
      console.error('Error fetching whatsapp_config:', configError)
      return NextResponse.json(
        { connected: false, reason: 'db_error', message: 'Failed to fetch configuration' },
        { status: 200 }
      )
    }

    if (!config) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'no_config',
          message:
            'No WhatsApp configuration saved yet. Fill in the form and click Save Configuration.',
        },
        { status: 200 }
      )
    }

    // Build the provider — this decrypts the at-rest secret. A failure
    // here means either incomplete credentials or a mismatched
    // ENCRYPTION_KEY; surface the latter as a recoverable reset prompt.
    let provider
    try {
      provider = providerFromConfigRow(config)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid configuration'
      const corrupted = /decrypt|ENCRYPTION_KEY/i.test(message)
      console.error('[whatsapp/config GET] provider resolution failed:', message)
      return NextResponse.json(
        {
          connected: false,
          reason: corrupted ? 'token_corrupted' : 'incomplete_config',
          needs_reset: corrupted,
          message: corrupted
            ? 'The stored credentials cannot be decrypted with the current ENCRYPTION_KEY. This usually means the key changed or differs between environments. Click "Reset Configuration" below, then re-save.'
            : message,
        },
        { status: 200 }
      )
    }

    try {
      const info = await provider.verifyConnection()
      return NextResponse.json({
        connected: true,
        provider: provider.name,
        phone_info: toPhoneInfo(info),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown provider error'
      console.error('[whatsapp/config GET] provider verification failed:', message)
      return NextResponse.json(
        {
          connected: false,
          reason: 'provider_error',
          provider: provider.name,
          message: `${provider.name === 'twilio' ? 'Twilio' : 'Meta'} rejected the credentials: ${message}`,
        },
        { status: 200 }
      )
    }
  } catch (error) {
    console.error('Error in WhatsApp config GET:', error)
    return NextResponse.json(
      { connected: false, reason: 'unknown', message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/whatsapp/config
 *
 * Saves or updates the WhatsApp config for the authenticated user.
 * Accepts either provider; verifies credentials with the provider
 * first, then encrypts the secret and stores it.
 *
 * Body (Meta):   { provider: 'meta', phone_number_id, waba_id?, access_token, verify_token? }
 * Body (Twilio): { provider: 'twilio', twilio_account_sid, twilio_auth_token,
 *                  twilio_whatsapp_number?, twilio_messaging_service_sid? }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const provider: 'meta' | 'twilio' | 'jasmin' =
      body.provider === 'twilio'
        ? 'twilio'
        : body.provider === 'jasmin'
          ? 'jasmin'
          : 'meta'

    const { data: existing } = await supabase
      .from('whatsapp_config')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (provider === 'twilio') {
      return saveTwilioConfig(supabase, user.id, body, existing?.id)
    }
    if (provider === 'jasmin') {
      return saveJasminConfig(supabase, user.id, body, existing?.id)
    }
    return saveMetaConfig(supabase, user.id, body, existing?.id)
  } catch (error) {
    console.error('Error in WhatsApp config POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function saveMetaConfig(
  supabase: any,
  userId: string,
  body: any,
  existingId?: string
) {
  const { phone_number_id, waba_id, access_token, verify_token } = body

  if (!access_token || !phone_number_id) {
    return NextResponse.json(
      { error: 'access_token and phone_number_id are required' },
      { status: 400 }
    )
  }

  let info: ConnectionInfo
  try {
    info = await createWhatsAppProvider({
      provider: 'meta',
      phoneNumberId: phone_number_id,
      accessToken: access_token,
    }).verifyConnection()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Meta API error'
    console.error('Meta API verification failed during save:', message)
    return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 400 })
  }

  let encryptedAccessToken: string
  let encryptedVerifyToken: string | null
  try {
    encryptedAccessToken = encrypt(access_token)
    encryptedVerifyToken = verify_token ? encrypt(verify_token) : null
  } catch (err) {
    console.error('Encryption failed:', err)
    return NextResponse.json(
      {
        error:
          'Failed to encrypt token. Check that ENCRYPTION_KEY is a valid 64-character hex string.',
      },
      { status: 500 }
    )
  }

  const row = {
    provider: 'meta' as const,
    phone_number_id,
    waba_id: waba_id || null,
    access_token: encryptedAccessToken,
    verify_token: encryptedVerifyToken,
    // Clear any stale credentials from other providers.
    twilio_account_sid: null,
    twilio_auth_token: null,
    twilio_whatsapp_number: null,
    twilio_messaging_service_sid: null,
    jasmin_base_url: null,
    jasmin_username: null,
    jasmin_password: null,
    jasmin_default_sender: null,
    status: 'connected' as const,
  }

  const result = existingId
    ? await supabase
        .from('whatsapp_config')
        .update({
          ...row,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
    : await supabase
        .from('whatsapp_config')
        .insert({ ...row, user_id: userId, connected_at: new Date().toISOString() })

  if (result.error) {
    console.error('Error saving whatsapp_config (meta):', result.error)
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    provider: 'meta',
    phone_info: toPhoneInfo(info),
  })
}

async function saveTwilioConfig(
  supabase: any,
  userId: string,
  body: any,
  existingId?: string
) {
  const {
    twilio_account_sid,
    twilio_auth_token,
    twilio_whatsapp_number,
    twilio_messaging_service_sid,
  } = body

  if (!twilio_account_sid || !twilio_auth_token) {
    return NextResponse.json(
      { error: 'twilio_account_sid and twilio_auth_token are required' },
      { status: 400 }
    )
  }
  if (!twilio_whatsapp_number && !twilio_messaging_service_sid) {
    return NextResponse.json(
      {
        error:
          'Provide a Twilio WhatsApp number (E.164) or a Messaging Service SID',
      },
      { status: 400 }
    )
  }

  let info: ConnectionInfo
  try {
    info = await createWhatsAppProvider({
      provider: 'twilio',
      accountSid: twilio_account_sid,
      authToken: twilio_auth_token,
      whatsappNumber: twilio_whatsapp_number || '',
      messagingServiceSid: twilio_messaging_service_sid || undefined,
    }).verifyConnection()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Twilio API error'
    console.error('Twilio verification failed during save:', message)
    return NextResponse.json({ error: `Twilio API error: ${message}` }, { status: 400 })
  }

  let encryptedAuthToken: string
  try {
    encryptedAuthToken = encrypt(twilio_auth_token)
  } catch (err) {
    console.error('Encryption failed:', err)
    return NextResponse.json(
      {
        error:
          'Failed to encrypt token. Check that ENCRYPTION_KEY is a valid 64-character hex string.',
      },
      { status: 500 }
    )
  }

  const row = {
    provider: 'twilio' as const,
    twilio_account_sid,
    twilio_auth_token: encryptedAuthToken,
    twilio_whatsapp_number: twilio_whatsapp_number || null,
    twilio_messaging_service_sid: twilio_messaging_service_sid || null,
    // Clear any stale credentials from other providers.
    phone_number_id: null,
    waba_id: null,
    access_token: null,
    verify_token: null,
    jasmin_base_url: null,
    jasmin_username: null,
    jasmin_password: null,
    jasmin_default_sender: null,
    status: 'connected' as const,
  }

  const result = existingId
    ? await supabase
        .from('whatsapp_config')
        .update({
          ...row,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
    : await supabase
        .from('whatsapp_config')
        .insert({ ...row, user_id: userId, connected_at: new Date().toISOString() })

  if (result.error) {
    console.error('Error saving whatsapp_config (twilio):', result.error)
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    provider: 'twilio',
    phone_info: toPhoneInfo(info),
  })
}

async function saveJasminConfig(
  supabase: any,
  userId: string,
  body: any,
  existingId?: string
) {
  const {
    jasmin_base_url,
    jasmin_username,
    jasmin_password,
    jasmin_default_sender,
  } = body

  if (!jasmin_base_url || !jasmin_username || !jasmin_password) {
    return NextResponse.json(
      {
        error:
          'jasmin_base_url, jasmin_username and jasmin_password are required',
      },
      { status: 400 }
    )
  }
  if (!/^https?:\/\//i.test(String(jasmin_base_url))) {
    return NextResponse.json(
      { error: 'jasmin_base_url must be an http(s) URL' },
      { status: 400 }
    )
  }

  let info: ConnectionInfo
  try {
    info = await createWhatsAppProvider({
      provider: 'jasmin',
      baseUrl: jasmin_base_url,
      username: jasmin_username,
      password: jasmin_password,
      defaultSender: jasmin_default_sender || '',
    }).verifyConnection()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown gateway error'
    console.error('Jasmin verification failed during save:', message)
    return NextResponse.json(
      { error: `SMS gateway error: ${message}` },
      { status: 400 }
    )
  }

  let encryptedPassword: string
  try {
    encryptedPassword = encrypt(jasmin_password)
  } catch (err) {
    console.error('Encryption failed:', err)
    return NextResponse.json(
      {
        error:
          'Failed to encrypt the gateway password. Check that ENCRYPTION_KEY is a valid 64-character hex string.',
      },
      { status: 500 }
    )
  }

  const row = {
    provider: 'jasmin' as const,
    jasmin_base_url: String(jasmin_base_url).trim().replace(/\/+$/, ''),
    jasmin_username,
    jasmin_password: encryptedPassword,
    jasmin_default_sender: jasmin_default_sender || null,
    // Clear any stale credentials from other providers.
    phone_number_id: null,
    waba_id: null,
    access_token: null,
    verify_token: null,
    twilio_account_sid: null,
    twilio_auth_token: null,
    twilio_whatsapp_number: null,
    twilio_messaging_service_sid: null,
    status: 'connected' as const,
  }

  const result = existingId
    ? await supabase
        .from('whatsapp_config')
        .update({
          ...row,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
    : await supabase
        .from('whatsapp_config')
        .insert({ ...row, user_id: userId, connected_at: new Date().toISOString() })

  if (result.error) {
    console.error('Error saving whatsapp_config (jasmin):', result.error)
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    provider: 'jasmin',
    phone_info: toPhoneInfo(info),
  })
}

/**
 * PATCH /api/whatsapp/config
 *
 * Updates only the SMS compliance + A2P/TCR registration fields on the
 * existing config row. Unlike POST it neither re-verifies the provider
 * nor touches any secret, so a tenant can adjust quiet hours or record
 * registration progress without re-entering the gateway password.
 *
 * Body (all optional): { sms_quiet_hours_start, sms_quiet_hours_end,
 *   sms_timezone, a2p_brand_id, a2p_campaign_id, a2p_status }
 */
const A2P_STATUSES = ['unregistered', 'pending', 'registered', 'rejected']

function validHour(v: unknown): v is number | null {
  return v === null || (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 23)
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const update: Record<string, unknown> = {}

    if ('sms_quiet_hours_start' in body) {
      if (!validHour(body.sms_quiet_hours_start)) {
        return NextResponse.json(
          { error: 'sms_quiet_hours_start must be an integer 0-23 or null' },
          { status: 400 }
        )
      }
      update.sms_quiet_hours_start = body.sms_quiet_hours_start
    }
    if ('sms_quiet_hours_end' in body) {
      if (!validHour(body.sms_quiet_hours_end)) {
        return NextResponse.json(
          { error: 'sms_quiet_hours_end must be an integer 0-23 or null' },
          { status: 400 }
        )
      }
      update.sms_quiet_hours_end = body.sms_quiet_hours_end
    }
    if ('sms_timezone' in body) {
      const tz = body.sms_timezone
      if (typeof tz !== 'string' || !tz.trim()) {
        return NextResponse.json(
          { error: 'sms_timezone must be a non-empty IANA timezone name' },
          { status: 400 }
        )
      }
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz })
      } catch {
        return NextResponse.json(
          { error: `Unknown timezone: ${tz}` },
          { status: 400 }
        )
      }
      update.sms_timezone = tz
    }
    if ('a2p_brand_id' in body) {
      update.a2p_brand_id = body.a2p_brand_id || null
    }
    if ('a2p_campaign_id' in body) {
      update.a2p_campaign_id = body.a2p_campaign_id || null
    }
    if ('a2p_status' in body) {
      if (!A2P_STATUSES.includes(body.a2p_status)) {
        return NextResponse.json(
          { error: `a2p_status must be one of: ${A2P_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }
      update.a2p_status = body.a2p_status
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: 'No updatable fields supplied' },
        { status: 400 }
      )
    }
    update.updated_at = new Date().toISOString()

    const { data: updated, error: updateError } = await supabase
      .from('whatsapp_config')
      .update(update)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle()

    if (updateError) {
      console.error('Error patching whatsapp_config:', updateError)
      return NextResponse.json(
        { error: 'Failed to update configuration' },
        { status: 500 }
      )
    }
    if (!updated) {
      return NextResponse.json(
        { error: 'No configuration to update — save your gateway connection first' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in WhatsApp config PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/whatsapp/config
 *
 * Removes the authenticated user's WhatsApp configuration row. Used by
 * the "Reset Configuration" button to recover from a corrupted
 * encrypted secret (mismatched ENCRYPTION_KEY across environments).
 */
export async function DELETE() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error: deleteError } = await supabase
      .from('whatsapp_config')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting whatsapp_config:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in WhatsApp config DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
