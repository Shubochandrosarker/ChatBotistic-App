/**
 * Dual-provider WhatsApp layer.
 *
 * The CRM talks to exactly one interface — `WhatsAppProvider` — and the
 * concrete provider (Meta Cloud API or Twilio) is chosen per org from
 * its `whatsapp_config.provider` column. Routes never branch on the
 * provider name; they call `createWhatsAppProvider()` with the decrypted
 * config and use the returned object.
 */

import { MetaProvider } from './meta-provider'
import { TwilioProvider } from './twilio-provider'
import { JasminProvider } from './jasmin-provider'

export type WhatsAppProviderName = 'meta' | 'twilio' | 'jasmin'

export interface SendTextOptions {
  to: string
  text: string
}

export interface SendTemplateOptions {
  to: string
  templateName: string
  language?: string
  params?: string[]
}

export interface SendResult {
  messageId: string
}

export interface ConnectionInfo {
  /** Human-readable account / number name, when the provider exposes it. */
  displayName?: string
  /** The WhatsApp phone number this config sends from, in E.164. */
  phoneNumber?: string
  /** Raw provider payload, for debugging in the settings UI. */
  raw?: unknown
}

export interface WhatsAppProvider {
  readonly name: WhatsAppProviderName
  /** Free-form text — only valid inside the 24-hour service window. */
  sendText(opts: SendTextOptions): Promise<SendResult>
  /** Pre-approved template — required for first-touch / out-of-window. */
  sendTemplate(opts: SendTemplateOptions): Promise<SendResult>
  /** Probe the credentials; throws on failure. */
  verifyConnection(): Promise<ConnectionInfo>
}

/**
 * Decrypted, provider-specific credentials. The DB stores secrets
 * encrypted; callers decrypt with `src/lib/whatsapp/encryption.ts`
 * before constructing a provider.
 */
export type WhatsAppProviderConfig =
  | {
      provider: 'meta'
      phoneNumberId: string
      accessToken: string
    }
  | {
      provider: 'twilio'
      accountSid: string
      authToken: string
      /** E.164 WhatsApp sender, e.g. "+14155238886". */
      whatsappNumber: string
      messagingServiceSid?: string
    }
  | {
      provider: 'jasmin'
      /** Base URL of the self-hosted Jasmin gateway's HTTP API. */
      baseUrl: string
      username: string
      password: string
      /** Sender ID / number SMS is sent from. */
      defaultSender: string
    }

export function createWhatsAppProvider(
  config: WhatsAppProviderConfig,
): WhatsAppProvider {
  switch (config.provider) {
    case 'meta':
      return new MetaProvider(config.phoneNumberId, config.accessToken)
    case 'twilio':
      return new TwilioProvider(
        config.accountSid,
        config.authToken,
        config.whatsappNumber,
        config.messagingServiceSid,
      )
    case 'jasmin':
      return new JasminProvider(
        config.baseUrl,
        config.username,
        config.password,
        config.defaultSender,
      )
    default: {
      const _exhaustive: never = config
      throw new Error(
        `Unknown WhatsApp provider: ${JSON.stringify(_exhaustive)}`,
      )
    }
  }
}
