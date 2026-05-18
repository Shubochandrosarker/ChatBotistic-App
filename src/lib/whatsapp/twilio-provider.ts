/**
 * Twilio implementation of `WhatsAppProvider`.
 *
 * Uses the Twilio REST API directly (form-encoded POST + HTTP Basic
 * auth) so the project takes on no extra SDK dependency.
 *
 * Address format: Twilio prefixes WhatsApp addresses with `whatsapp:`.
 * Callers pass plain E.164 numbers; this adapter adds/strips the
 * prefix.
 *
 * Templates: Twilio sends pre-approved content via a Content SID
 * (`HX...`). The CRM's `templateName` is therefore expected to be a
 * Twilio Content SID when the org runs on the Twilio provider. A
 * non-`HX` value throws a clear error rather than silently sending
 * the wrong thing.
 */

import type {
  WhatsAppProvider,
  SendTextOptions,
  SendTemplateOptions,
  SendResult,
  ConnectionInfo,
} from './provider'

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01'

interface TwilioMessageResponse {
  sid?: string
  error_message?: string | null
  message?: string
  status?: number
}

interface TwilioAccountResponse {
  friendly_name?: string
  status?: string
  message?: string
}

function waAddress(number: string): string {
  const trimmed = number.trim()
  return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`
}

export class TwilioProvider implements WhatsAppProvider {
  readonly name = 'twilio' as const
  private readonly authHeader: string

  constructor(
    private readonly accountSid: string,
    authToken: string,
    private readonly whatsappNumber: string,
    private readonly messagingServiceSid?: string,
  ) {
    if (!accountSid || !authToken) {
      throw new Error('Twilio provider requires accountSid and authToken')
    }
    if (!whatsappNumber && !messagingServiceSid) {
      throw new Error(
        'Twilio provider requires a whatsappNumber or a messagingServiceSid',
      )
    }
    this.authHeader =
      'Basic ' +
      Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  }

  private async postMessage(
    params: Record<string, string>,
  ): Promise<SendResult> {
    // Sender: a Messaging Service takes precedence over a bare number.
    if (this.messagingServiceSid) {
      params.MessagingServiceSid = this.messagingServiceSid
    } else {
      params.From = waAddress(this.whatsappNumber)
    }

    const response = await fetch(
      `${TWILIO_API_BASE}/Accounts/${this.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params).toString(),
      },
    )

    const data = (await response.json().catch(() => ({}))) as TwilioMessageResponse
    if (!response.ok || !data.sid) {
      throw new Error(
        data.error_message ||
          data.message ||
          `Twilio API error: ${response.status}`,
      )
    }
    return { messageId: data.sid }
  }

  async sendText(opts: SendTextOptions): Promise<SendResult> {
    return this.postMessage({
      To: waAddress(opts.to),
      Body: opts.text,
    })
  }

  async sendTemplate(opts: SendTemplateOptions): Promise<SendResult> {
    if (!opts.templateName.startsWith('HX')) {
      throw new Error(
        `Twilio requires a Content SID (HX...) to send a template; ` +
          `received "${opts.templateName}". Map this template to a ` +
          `Twilio Content template and store its SID.`,
      )
    }

    const params: Record<string, string> = {
      To: waAddress(opts.to),
      ContentSid: opts.templateName,
    }

    // Twilio Content variables are positional: {"1": "...", "2": "..."}.
    if (opts.params && opts.params.length > 0) {
      const variables: Record<string, string> = {}
      opts.params.forEach((value, index) => {
        variables[String(index + 1)] = String(value)
      })
      params.ContentVariables = JSON.stringify(variables)
    }

    return this.postMessage(params)
  }

  async verifyConnection(): Promise<ConnectionInfo> {
    const response = await fetch(
      `${TWILIO_API_BASE}/Accounts/${this.accountSid}.json`,
      { headers: { Authorization: this.authHeader } },
    )
    const data = (await response.json().catch(() => ({}))) as TwilioAccountResponse
    if (!response.ok) {
      throw new Error(
        data.message || `Twilio API rejected the credentials: ${response.status}`,
      )
    }
    if (data.status && data.status !== 'active') {
      throw new Error(`Twilio account status is "${data.status}", not active`)
    }
    return {
      displayName: data.friendly_name,
      phoneNumber: this.whatsappNumber,
      raw: data,
    }
  }
}
