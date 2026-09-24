import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { providerFromConfigRow } from '@/lib/whatsapp/load-provider'
import { encrypt, decrypt, isLegacyFormat } from '@/lib/whatsapp/encryption'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
  maskPhone,
} from '@/lib/whatsapp/phone-utils'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'
import {
  evaluateSmsPolicy,
  getConsent,
  isSendAllowed,
  isWithinQuietHours,
  logSms,
  type SmsMessageCategory,
} from '@/lib/sms/compliance'
import { checkMonthlyMessageCap } from '@/lib/tochat/entitlements'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Per-user rate limit. Bucket key is scoped to this route so
    // `/broadcast` has an independent budget.
    const limit = checkRateLimit(`send:${user.id}`, RATE_LIMITS.send)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    // Plan entitlement: the org's monthly message allowance is
    // enforced server-side (Free = 100/month), counted from the
    // messages table so retries and webhook replays don't double-count.
    const messageCap = await checkMonthlyMessageCap(supabase, user.id, 1)
    if (!messageCap.allowed) {
      return NextResponse.json(
        { error: messageCap.message, limit: messageCap.limit },
        { status: 403 },
      )
    }

    const body = await request.json()
    const {
      conversation_id,
      message_type,
      message_category,
      content_text,
      media_url,
      template_name,
      template_params,
    } = body

    if (!conversation_id || !message_type) {
      return NextResponse.json(
        { error: 'conversation_id and message_type are required' },
        { status: 400 }
      )
    }

    if (message_type === 'text' && !content_text) {
      return NextResponse.json(
        { error: 'content_text is required for text messages' },
        { status: 400 }
      )
    }

    if (message_type === 'template' && !template_name) {
      return NextResponse.json(
        { error: 'template_name is required for template messages' },
        { status: 400 }
      )
    }

    // Fetch conversation and contact
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*, contact:contacts(*)')
      .eq('id', conversation_id)
      .eq('user_id', user.id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    const contact = conversation.contact
    if (!contact?.phone) {
      return NextResponse.json(
        { error: 'Contact phone number not found' },
        { status: 400 }
      )
    }

    // Sanitize and validate phone
    const sanitizedPhone = sanitizePhoneForMeta(contact.phone)
    if (!isValidE164(sanitizedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // Fetch and decrypt WhatsApp config
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp not configured. Please set up your WhatsApp integration first.' },
        { status: 400 }
      )
    }

    // Resolve the org's WhatsApp provider (Meta or Twilio) from the
    // stored config. Decryption of the at-rest secrets happens here.
    let provider
    try {
      provider = providerFromConfigRow(config)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Invalid WhatsApp configuration'
      console.error('[whatsapp/send] provider resolution failed:', message)
      return NextResponse.json({ error: message }, { status: 400 })
    }

    // SMS compliance gate. Only the self-hosted SMS gateway is subject
    // to TCPA / carrier opt-in rules here — the WhatsApp providers have
    // their own consent model enforced by Meta.
    if (provider.name === 'jasmin') {
      const category = message_category as SmsMessageCategory | undefined
      if (
        !category ||
        !['transactional', 'support', 'marketing'].includes(category)
      ) {
        return NextResponse.json(
          {
            error:
              "message_category is required for SMS and must be one of: transactional, support, marketing",
          },
          { status: 400 }
        )
      }

      const decision = await isSendAllowed(supabase, contact.id)
      const consent = await getConsent(supabase, contact.id)
      const policy = evaluateSmsPolicy({
        consent,
        messageCategory: category,
        provider: 'jasmin',
        inQuietHours: isWithinQuietHours(config),
        allowFflMarketing: process.env.ALLOW_FFL_MARKETING_SMS === 'true',
      })
      if (!decision.allowed || !policy.allowed) {
        const reason = !decision.allowed
          ? decision.reason ?? 'SMS blocked by consent policy'
          : policy.reasons.join('; ')
        await logSms(supabase, {
          userId: user.id,
          contactId: contact.id,
          conversationId: conversation_id,
          direction: 'outbound',
          phone: sanitizedPhone,
          body: content_text ?? null,
          status: 'blocked',
          blockReason: reason,
        })
        return NextResponse.json(
          { error: `SMS blocked: ${reason}` },
          { status: 403 }
        )
      }
    }

    // Self-heal legacy CBC-encrypted Meta tokens. Fire-and-forget: a
    // failed upgrade just means the next send tries again. Idempotent —
    // concurrent sends produce valid GCM ciphertexts of the same
    // plaintext, last write wins. Only Meta stores access_token.
    if (
      (config.provider ?? 'meta') === 'meta' &&
      config.access_token &&
      isLegacyFormat(config.access_token)
    ) {
      const upgraded = encrypt(decrypt(config.access_token))
      void supabase
        .from('whatsapp_config')
        .update({ access_token: upgraded })
        .eq('id', config.id)
        .then(({ error }) => {
          if (error) {
            console.warn(
              '[whatsapp/send] access_token GCM upgrade failed:',
              error.message,
            )
          }
        })
    }

    // Send via the resolved provider — retry with phone-number variants
    // if the provider rejects with "recipient not in allowed list"
    // (common in sandbox / when a number was registered with/without a
    // trunk 0). If an alternate format succeeds, we persist it back to
    // the contact row so the next send goes through on the first try.
    let waMessageId = ''
    let workingPhone = sanitizedPhone

    const attempt = async (phone: string): Promise<string> => {
      if (message_type === 'template') {
        const result = await provider.sendTemplate({
          to: phone,
          templateName: template_name,
          params: template_params || [],
        })
        return result.messageId
      }
      const result = await provider.sendText({
        to: phone,
        text: content_text,
      })
      return result.messageId
    }

    try {
      const variants = phoneVariants(sanitizedPhone)
      let lastError: unknown = null

      for (const variant of variants) {
        try {
          waMessageId = await attempt(variant)
          workingPhone = variant
          lastError = null
          break
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          // Only retry when the failure is specifically that the
          // recipient isn't in Meta's allowed list. Any other error
          // (bad token, invalid template, etc.) bubbles up immediately.
          if (!isRecipientNotAllowedError(message)) {
            throw err
          }
          lastError = err
          console.warn(`[whatsapp/send] variant "${variant}" rejected by Meta, trying next…`)
        }
      }

      if (lastError) throw lastError
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown WhatsApp provider error'
      console.error(
        `[whatsapp/send] ${provider.name} send failed for all variants:`,
        message,
      )
      return NextResponse.json(
        { error: `WhatsApp provider error: ${message}` },
        { status: 502 }
      )
    }

    // If a non-original variant succeeded, update the contact so future
    // sends go straight through. sanitizePhoneForMeta on workingPhone
    // will yield workingPhone itself, so re-storing preserves it.
    if (workingPhone !== sanitizedPhone) {
      // Masked: this line lands in the hosting provider's log stream,
      // which is a far less protected place than the contacts table.
      // The last four digits are enough to correlate a correction with
      // a specific contact while debugging.
      console.info(
        `[whatsapp/send] Auto-corrected contact phone: ${maskPhone(sanitizedPhone)} → ${maskPhone(workingPhone)}`
      )
      await supabase
        .from('contacts')
        .update({ phone: workingPhone, phone_normalized: workingPhone })
        .eq('id', contact.id)
    }

    // Insert message into DB — field names MUST match the messages schema
    // (see supabase/migrations/001_initial_schema.sql):
    //   conversation_id, sender_type, content_type, content_text,
    //   media_url, template_name, message_id, status, created_at
    const { data: messageRecord, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        sender_type: 'agent',
        content_type: message_type,
        content_text: content_text || null,
        media_url: media_url || null,
        template_name: template_name || null,
        message_id: waMessageId,
        status: 'sent',
      })
      .select()
      .single()

    if (msgError) {
      console.error('Error inserting sent message:', msgError)
      return NextResponse.json(
        { error: `Message sent to Meta but failed to save to DB: ${msgError.message}` },
        { status: 500 }
      )
    }

    // Audit-log every outbound SMS for TCPA dispute resolution.
    if (provider.name === 'jasmin') {
      await logSms(supabase, {
        userId: user.id,
        contactId: contact.id,
        conversationId: conversation_id,
        direction: 'outbound',
        phone: workingPhone,
        body: content_text ?? null,
        messageId: waMessageId,
        status: 'sent',
      })
    }

    // Update conversation
    await supabase
      .from('conversations')
      .update({
        last_message_text: content_text || `[${message_type}]`,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversation_id)

    return NextResponse.json({
      success: true,
      message_id: messageRecord.id,
      whatsapp_message_id: waMessageId,
    })
  } catch (error) {
    console.error('Error in WhatsApp send POST:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
