/**
 * Meta Cloud API implementation of `WhatsAppProvider`.
 *
 * Thin adapter over the existing functional helpers in `meta-api.ts` —
 * those keep their named-parameter style and direct call sites; this
 * class is the polymorphic entry point for provider-agnostic code.
 */

import {
  sendTextMessage,
  sendTemplateMessage,
  verifyPhoneNumber,
} from './meta-api'
import type {
  WhatsAppProvider,
  SendTextOptions,
  SendTemplateOptions,
  SendResult,
  ConnectionInfo,
} from './provider'

export class MetaProvider implements WhatsAppProvider {
  readonly name = 'meta' as const

  constructor(
    private readonly phoneNumberId: string,
    private readonly accessToken: string,
  ) {
    if (!phoneNumberId || !accessToken) {
      throw new Error('Meta provider requires phoneNumberId and accessToken')
    }
  }

  async sendText(opts: SendTextOptions): Promise<SendResult> {
    return sendTextMessage({
      phoneNumberId: this.phoneNumberId,
      accessToken: this.accessToken,
      to: opts.to,
      text: opts.text,
    })
  }

  async sendTemplate(opts: SendTemplateOptions): Promise<SendResult> {
    return sendTemplateMessage({
      phoneNumberId: this.phoneNumberId,
      accessToken: this.accessToken,
      to: opts.to,
      templateName: opts.templateName,
      language: opts.language,
      params: opts.params,
    })
  }

  async verifyConnection(): Promise<ConnectionInfo> {
    const info = await verifyPhoneNumber({
      phoneNumberId: this.phoneNumberId,
      accessToken: this.accessToken,
    })
    return {
      displayName: info.verified_name,
      phoneNumber: info.display_phone_number,
      raw: info,
    }
  }
}
