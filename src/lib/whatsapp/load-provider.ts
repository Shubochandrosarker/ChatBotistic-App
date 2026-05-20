/**
 * Bridge between a `whatsapp_config` database row and a live
 * `WhatsAppProvider`. Handles decryption of the at-rest secrets and
 * provider-specific validation in one place so API routes don't
 * repeat it.
 */

import { decrypt } from './encryption'
import { createWhatsAppProvider, type WhatsAppProvider } from './provider'

/** Shape of a `whatsapp_config` row, as selected by the API routes. */
export interface WhatsAppConfigRow {
  provider?: 'meta' | 'twilio' | 'jasmin' | null
  phone_number_id?: string | null
  access_token?: string | null
  twilio_account_sid?: string | null
  twilio_auth_token?: string | null
  twilio_whatsapp_number?: string | null
  twilio_messaging_service_sid?: string | null
  jasmin_base_url?: string | null
  jasmin_username?: string | null
  jasmin_password?: string | null
  jasmin_default_sender?: string | null
}

/**
 * Build a provider from a config row. Throws a descriptive error if
 * the row is missing the credentials its provider needs, or if a
 * stored secret can't be decrypted with the current `ENCRYPTION_KEY`.
 */
export function providerFromConfigRow(
  row: WhatsAppConfigRow,
): WhatsAppProvider {
  const provider = row.provider ?? 'meta'

  if (provider === 'twilio') {
    if (!row.twilio_account_sid || !row.twilio_auth_token) {
      throw new Error('Twilio configuration is incomplete (missing account SID or auth token)')
    }
    if (!row.twilio_whatsapp_number && !row.twilio_messaging_service_sid) {
      throw new Error('Twilio configuration needs a WhatsApp number or a Messaging Service SID')
    }
    return createWhatsAppProvider({
      provider: 'twilio',
      accountSid: row.twilio_account_sid,
      authToken: decrypt(row.twilio_auth_token),
      whatsappNumber: row.twilio_whatsapp_number ?? '',
      messagingServiceSid: row.twilio_messaging_service_sid ?? undefined,
    })
  }

  if (provider === 'jasmin') {
    if (!row.jasmin_base_url || !row.jasmin_username || !row.jasmin_password) {
      throw new Error(
        'SMS gateway configuration is incomplete (missing gateway URL, username, or password)',
      )
    }
    return createWhatsAppProvider({
      provider: 'jasmin',
      baseUrl: row.jasmin_base_url,
      username: row.jasmin_username,
      password: decrypt(row.jasmin_password),
      defaultSender: row.jasmin_default_sender ?? '',
    })
  }

  if (!row.phone_number_id || !row.access_token) {
    throw new Error('Meta configuration is incomplete (missing phone number ID or access token)')
  }
  return createWhatsAppProvider({
    provider: 'meta',
    phoneNumberId: row.phone_number_id,
    accessToken: decrypt(row.access_token),
  })
}
