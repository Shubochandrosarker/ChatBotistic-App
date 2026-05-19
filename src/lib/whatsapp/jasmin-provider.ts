/**
 * Self-hosted SMS gateway implementation of `WhatsAppProvider`.
 *
 * Talks to a Jasmin SMS Gateway (https://jasminsms.com) over its HTTP
 * API. Jasmin is open-source SMPP middleware the tenant self-hosts; the
 * CRM never speaks SMPP directly — it submits messages to Jasmin's
 * `/send` endpoint and Jasmin relays them over its SMPP route.
 *
 * This is an SMS channel, not WhatsApp: there is no template concept and
 * no 24-hour service window. `sendTemplate` therefore rejects — SMS
 * sends go through `sendText`.
 *
 * Delivery receipts (DLR) and inbound (MO) messages are delivered by
 * Jasmin to `/api/sms/webhook`. Per-message DLR callbacks are wired up
 * here when NEXT_PUBLIC_SITE_URL is set; MO routing is configured once
 * inside Jasmin itself by the operator.
 */

import type {
  WhatsAppProvider,
  SendTextOptions,
  SendTemplateOptions,
  SendResult,
  ConnectionInfo,
} from './provider'

/** Strip a leading `+` — Jasmin expects bare international MSISDNs. */
function msisdn(number: string): string {
  return number.trim().replace(/^\+/, '')
}

export class JasminProvider implements WhatsAppProvider {
  readonly name = 'jasmin' as const
  private readonly baseUrl: string

  constructor(
    baseUrl: string,
    private readonly username: string,
    private readonly password: string,
    private readonly defaultSender: string,
  ) {
    if (!baseUrl || !username || !password) {
      throw new Error(
        'Jasmin provider requires baseUrl, username and password',
      )
    }
    // Normalize: no trailing slash, so `${baseUrl}/send` is well-formed.
    this.baseUrl = baseUrl.trim().replace(/\/+$/, '')
  }

  /** Per-message delivery-receipt callback, when a public URL is known. */
  private dlrUrl(): string | null {
    const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')
    if (!site) return null
    const secret = process.env.SMS_WEBHOOK_SECRET
    const query = secret ? `?token=${encodeURIComponent(secret)}` : ''
    return `${site}/api/sms/webhook${query}`
  }

  async sendText(opts: SendTextOptions): Promise<SendResult> {
    const params: Record<string, string> = {
      username: this.username,
      password: this.password,
      to: msisdn(opts.to),
      content: opts.text,
    }
    if (this.defaultSender) params.from = this.defaultSender

    const dlr = this.dlrUrl()
    if (dlr) {
      params.dlr = 'yes'
      params['dlr-url'] = dlr
      params['dlr-level'] = '3' // SMSC + terminal receipts
      params['dlr-method'] = 'POST'
    }

    const response = await fetch(`${this.baseUrl}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    })

    const body = (await response.text()).trim()
    // Jasmin replies `Success "<uuid>"` on success, `Error "<reason>"`
    // (with a 4xx/5xx status) on failure.
    const success = body.match(/^Success\s+"?([^"]+)"?/i)
    if (!response.ok || !success) {
      const reason =
        body.match(/^Error\s+"?([^"]+)"?/i)?.[1] ||
        body ||
        `HTTP ${response.status}`
      throw new Error(`Jasmin gateway error: ${reason}`)
    }
    return { messageId: success[1] }
  }

  async sendTemplate(_opts: SendTemplateOptions): Promise<SendResult> {
    void _opts
    throw new Error(
      'The SMS gateway has no template concept — send SMS as plain text via sendText.',
    )
  }

  async verifyConnection(): Promise<ConnectionInfo> {
    // Jasmin's `/ping` proves the gateway URL is reachable and is a
    // Jasmin instance. Credentials are exercised on the first real send.
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/ping`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Cannot reach the Jasmin gateway: ${message}`)
    }

    const body = (await response.text().catch(() => '')).trim()
    if (!response.ok || !/PONG/i.test(body)) {
      throw new Error(
        `The gateway URL did not respond as a Jasmin instance (HTTP ${response.status})`,
      )
    }

    return {
      displayName: 'Jasmin SMS Gateway',
      phoneNumber: this.defaultSender || undefined,
      raw: { ping: body },
    }
  }
}
