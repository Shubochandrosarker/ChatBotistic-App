import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { providerFromConfigRow } from '@/lib/whatsapp/load-provider'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'
import {
  isSendAllowed,
  isWithinQuietHours,
  logSms,
} from '@/lib/sms/compliance'
import { checkMonthlyMessageCap } from '@/lib/tochat/entitlements'

interface BroadcastResult {
  phone: string
  status: 'sent' | 'failed'
  whatsapp_message_id?: string
  error?: string
}

/**
 * Fan-out endpoint for broadcasts. Provider-aware:
 *
 *   - meta / twilio  → sends the WhatsApp template `template_name`
 *                      with per-recipient `params`.
 *   - jasmin (SMS)   → sends free-form `message_text`, substituting
 *                      {{1}}, {{2}}, … from per-recipient `params`.
 *                      Each recipient is consent-checked first and the
 *                      whole call is blocked during quiet hours; every
 *                      send is written to the SMS audit log.
 *
 * Input shapes (both accepted):
 *   NEW:    { recipients: [{ phone, params?, contact_id? }], ... }
 *   LEGACY: { phone_numbers: string[], template_params?: string[], ... }
 */
interface NewRecipient {
  phone: string
  params?: string[]
  contact_id?: string
}

/** Replace {{1}}, {{2}}, … in an SMS body with positional params. */
function renderSmsBody(text: string, params: string[]): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => {
    const idx = Number(n) - 1
    return params[idx] ?? ''
  })
}

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

    // Per-user budget on *starting* a campaign (not messages within one).
    const limit = checkRateLimit(`broadcast:${user.id}`, RATE_LIMITS.broadcast)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const body = await request.json()
    const {
      recipients: newRecipients,
      phone_numbers,
      template_name,
      template_language,
      template_params,
      message_text,
    } = body

    let recipients: NewRecipient[]
    if (Array.isArray(newRecipients) && newRecipients.length > 0) {
      recipients = newRecipients
    } else if (Array.isArray(phone_numbers) && phone_numbers.length > 0) {
      const shared: string[] = Array.isArray(template_params)
        ? template_params
        : []
      recipients = phone_numbers.map((phone: string) => ({
        phone,
        params: shared,
      }))
    } else {
      return NextResponse.json(
        {
          error:
            'Provide either `recipients` (preferred) or `phone_numbers` — must be a non-empty array',
        },
        { status: 400 }
      )
    }

    // Plan entitlement: reject a campaign that would blow past the
    // org's monthly message allowance before the first send, not
    // halfway through the fan-out.
    const messageCap = await checkMonthlyMessageCap(supabase, user.id, recipients.length)
    if (!messageCap.allowed) {
      return NextResponse.json(
        {
          error: messageCap.message,
          limit: messageCap.limit,
          attempted: recipients.length,
        },
        { status: 403 },
      )
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        {
          error:
            'Messaging is not configured. Please set up your messaging integration first.',
        },
        { status: 400 }
      )
    }

    let provider
    try {
      provider = providerFromConfigRow(config)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Invalid messaging configuration'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const isSms = provider.name === 'jasmin'

    if (isSms) {
      if (!message_text || typeof message_text !== 'string') {
        return NextResponse.json(
          { error: 'message_text is required for an SMS broadcast' },
          { status: 400 }
        )
      }
      // Quiet hours gate the entire campaign — fail fast.
      if (isWithinQuietHours(config)) {
        return NextResponse.json(
          { error: 'SMS broadcast blocked: outside the allowed sending hours' },
          { status: 403 }
        )
      }
    } else if (!template_name) {
      return NextResponse.json(
        { error: 'template_name is required' },
        { status: 400 }
      )
    }

    const results: BroadcastResult[] = []
    let sentCount = 0
    let failedCount = 0

    for (const recipient of recipients) {
      const sanitized = sanitizePhoneForMeta(recipient.phone)
      if (!isValidE164(sanitized)) {
        results.push({
          phone: recipient.phone,
          status: 'failed',
          error: 'Invalid phone number format',
        })
        failedCount++
        continue
      }

      // SMS: skip any recipient lacking recorded express consent.
      if (isSms) {
        if (!recipient.contact_id) {
          results.push({
            phone: recipient.phone,
            status: 'failed',
            error: 'Missing contact reference for consent check',
          })
          failedCount++
          continue
        }
        const decision = await isSendAllowed(supabase, recipient.contact_id)
        if (!decision.allowed) {
          await logSms(supabase, {
            userId: user.id,
            contactId: recipient.contact_id,
            direction: 'outbound',
            phone: sanitized,
            body: message_text,
            status: 'blocked',
            blockReason: decision.reason,
          })
          results.push({
            phone: recipient.phone,
            status: 'failed',
            error: `SMS blocked: ${decision.reason}`,
          })
          failedCount++
          continue
        }
      }

      const params = recipient.params ?? []
      const variants = phoneVariants(sanitized)
      let sentMessageId: string | null = null
      let lastError: string | null = null

      for (const variant of variants) {
        try {
          const result = isSms
            ? await provider.sendText({
                to: variant,
                text: renderSmsBody(message_text as string, params),
              })
            : await provider.sendTemplate({
                to: variant,
                templateName: template_name,
                language: template_language || 'en_US',
                params,
              })
          sentMessageId = result.messageId
          lastError = null
          break
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          lastError = errorMessage
          // Only "recipient not in allowed list" is worth a variant retry.
          if (!isRecipientNotAllowedError(errorMessage)) break
        }
      }

      if (sentMessageId) {
        results.push({
          phone: recipient.phone,
          status: 'sent',
          whatsapp_message_id: sentMessageId,
        })
        sentCount++
        if (isSms) {
          await logSms(supabase, {
            userId: user.id,
            contactId: recipient.contact_id ?? null,
            direction: 'outbound',
            phone: sanitized,
            body: renderSmsBody(message_text as string, params),
            messageId: sentMessageId,
            status: 'sent',
          })
        }
      } else {
        console.error(
          `Failed to send broadcast to ${recipient.phone}:`,
          lastError
        )
        results.push({
          phone: recipient.phone,
          status: 'failed',
          error: lastError || 'Unknown error',
        })
        failedCount++
      }
    }

    return NextResponse.json({
      success: true,
      total: recipients.length,
      sent: sentCount,
      failed: failedCount,
      results,
    })
  } catch (error) {
    console.error('Error in broadcast POST:', error)
    return NextResponse.json(
      { error: 'Failed to process broadcast' },
      { status: 500 }
    )
  }
}
