/**
 * Self-hosted SMS gateway webhook (Jasmin).
 *
 * Jasmin delivers two kinds of callbacks here:
 *   - DLR  — delivery receipts for messages we submitted (`id`,
 *            `message_status`, `level`).
 *   - MO   — mobile-originated / inbound messages (`from`, `to`,
 *            `content`, `id`).
 *
 * Jasmin cannot attach an HMAC signature, so the endpoint is
 * authenticated with a shared secret passed as `?token=` — the same
 * secret JasminProvider appends to the per-send DLR URL, and the one
 * the operator appends to the MO HTTP connector URL in Jasmin. Set it
 * via the SMS_WEBHOOK_SECRET environment variable.
 *
 * Both GET and POST are accepted because Jasmin's DLR and MO HTTP
 * methods are independently configurable.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone, phonesMatch } from '@/lib/whatsapp/phone-utils'
import { providerFromConfigRow } from '@/lib/whatsapp/load-provider'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import {
  classifyKeyword,
<<<<<<< HEAD
=======
  logConsentEvent,
>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)
  setOptOut,
  setOptIn,
  logSms,
  STOP_CONFIRM_MESSAGE,
  START_CONFIRM_MESSAGE,
  HELP_MESSAGE,
} from '@/lib/sms/compliance'

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

/** Collect params from both the query string and a form-encoded body. */
async function collectParams(request: Request): Promise<Record<string, string>> {
  const params: Record<string, string> = {}
  const url = new URL(request.url)
  for (const [k, v] of url.searchParams) params[k] = v

  if (request.method === 'POST') {
    const body = await request.text()
    for (const [k, v] of new URLSearchParams(body)) params[k] = v
  }
  return params
}

<<<<<<< HEAD
function authorized(params: Record<string, string>): boolean {
=======
function authorized(params: Record<string, string>, request: Request): boolean {
>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)
  const secret = process.env.SMS_WEBHOOK_SECRET
  if (!secret) {
    console.error('[sms-webhook] SMS_WEBHOOK_SECRET is not set — rejecting')
    return false
  }
<<<<<<< HEAD
=======
  const headerSecret = request.headers.get('x-sms-webhook-secret')
  if (headerSecret && headerSecret === secret) return true
>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)
  return params.token === secret
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}

async function handle(request: Request) {
  const params = await collectParams(request)

<<<<<<< HEAD
  if (!authorized(params)) {
=======
  if (!authorized(params, request)) {
>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (params.message_status) {
      await handleDeliveryReceipt(params)
    } else if (params.from && params.content !== undefined) {
      await handleInboundMessage(params)
    }
  } catch (err) {
    console.error('[sms-webhook] processing error:', err)
  }

  // Jasmin treats any 2xx as "ACK" — return a small body.
  return new Response('ACK', { status: 200 })
}

// Jasmin DLR states (SMPP message_state names) mapped onto the
// messages.status CHECK constraint ('sending','sent','delivered',
// 'read','failed').
function mapDeliveryStatus(state: string): string | null {
  switch (state.toUpperCase()) {
    case 'DELIVRD':
      return 'delivered'
    case 'ESME_ROK':
      return 'sent'
    case 'ACCEPTD':
    case 'ENROUTE':
    case 'UNKNOWN':
      return 'sending'
    case 'UNDELIV':
    case 'EXPIRED':
    case 'DELETED':
    case 'REJECTD':
      return 'failed'
    default:
      return null
  }
}

const RECIPIENT_LADDER = ['pending', 'sent', 'delivered', 'read', 'replied']
function isForwardTransition(current: string, incoming: string): boolean {
  if (incoming === 'failed') return current === 'pending' || current === 'sent'
  if (current === 'failed') return false
  const ci = RECIPIENT_LADDER.indexOf(current)
  const ii = RECIPIENT_LADDER.indexOf(incoming)
  if (ii < 0) return false
  if (ci < 0) return true
  return ii > ci
}

async function handleDeliveryReceipt(params: Record<string, string>) {
  const messageId = params.id
  const mapped = mapDeliveryStatus(params.message_status ?? '')
  if (!messageId || !mapped) return

  const { error: msgErr } = await supabaseAdmin()
    .from('messages')
    .update({ status: mapped })
    .eq('message_id', messageId)
  if (msgErr) console.error('[sms-webhook] message status update failed:', msgErr)

  const { data: recipient, error: recErr } = await supabaseAdmin()
    .from('broadcast_recipients')
    .select('id, status')
    .eq('whatsapp_message_id', messageId)
    .maybeSingle()
  if (recErr || !recipient) return

  if (!isForwardTransition(recipient.status, mapped)) return

  const nowIso = new Date().toISOString()
  const update: Record<string, unknown> = { status: mapped }
  if (mapped === 'sent') update.sent_at = nowIso
  if (mapped === 'delivered') update.delivered_at = nowIso

  const { error: recUpdErr } = await supabaseAdmin()
    .from('broadcast_recipients')
    .update(update)
    .eq('id', recipient.id)
  if (recUpdErr)
    console.error('[sms-webhook] recipient status update failed:', recUpdErr)
}

async function handleInboundMessage(params: Record<string, string>) {
  const senderPhone = normalizePhone(params.from)
  const recipientNumber = params.to ? normalizePhone(params.to) : ''
  const content = params.content ?? ''
  const messageId = params.id || undefined

  // Resolve the tenant: the inbound `to` is one of the SMS-gateway
  // configs' default sender numbers.
  const { data: configs, error: cfgErr } = await supabaseAdmin()
    .from('whatsapp_config')
    .select('*')
    .eq('provider', 'jasmin')
  if (cfgErr || !configs || configs.length === 0) {
    console.error('[sms-webhook] no SMS-gateway config for inbound message')
    return
  }

  const config =
    configs.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) =>
        c.jasmin_default_sender &&
        phonesMatch(c.jasmin_default_sender, recipientNumber)
    ) ?? (configs.length === 1 ? configs[0] : null)

  if (!config) {
    console.error(
      '[sms-webhook] inbound `to` matched no gateway sender:',
      recipientNumber
    )
    return
  }
  const userId = config.user_id

  const contact = await findOrCreateContact(userId, senderPhone)
  if (!contact) return
  const conversation = await findOrCreateConversation(userId, contact.id)
  if (!conversation) return

  const { count: priorCustomerMsgCount } = await supabaseAdmin()
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id)
    .eq('sender_type', 'customer')
  const isFirstInboundMessage = (priorCustomerMsgCount ?? 0) === 0

  const { error: msgError } = await supabaseAdmin().from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'customer',
    content_type: 'text',
    content_text: content,
    message_id: messageId,
    status: 'delivered',
    created_at: new Date().toISOString(),
  })
  if (msgError) {
    console.error('[sms-webhook] message insert failed:', msgError)
    return
  }

  await supabaseAdmin()
    .from('conversations')
    .update({
      last_message_text: content || '[sms]',
      last_message_at: new Date().toISOString(),
      unread_count: (conversation.unread_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id)

  await flagBroadcastReplyIfAny(userId, contact.id)

  // Honor carrier opt-out / opt-in / help keywords before anything else.
  const keyword = classifyKeyword(content)
  if (keyword === 'stop') {
<<<<<<< HEAD
    await setOptOut(supabaseAdmin(), userId, contact.id)
    await sendAutoReply(config, senderPhone, STOP_CONFIRM_MESSAGE)
  } else if (keyword === 'start') {
    await setOptIn(supabaseAdmin(), userId, contact.id, { source: 'keyword' })
    await sendAutoReply(config, senderPhone, START_CONFIRM_MESSAGE)
  } else if (keyword === 'help') {
=======
    await setOptOut(supabaseAdmin(), userId, contact.id, {
      source: 'keyword',
      userAgent: 'jasmin-webhook',
      details: { keyword: 'STOP' },
    })
    await sendAutoReply(config, senderPhone, STOP_CONFIRM_MESSAGE)
  } else if (keyword === 'start') {
    await setOptIn(supabaseAdmin(), userId, contact.id, {
      source: 'keyword',
      ageConfirmed: true,
      userAgent: 'jasmin-webhook',
      details: { keyword: 'START' },
    })
    await sendAutoReply(config, senderPhone, START_CONFIRM_MESSAGE)
  } else if (keyword === 'help') {
    await logConsentEvent(supabaseAdmin(), {
      userId,
      contactId: contact.id,
      action: 'help',
      source: 'keyword',
      userAgent: 'jasmin-webhook',
      details: { keyword: 'HELP' },
    })
>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)
    await sendAutoReply(config, senderPhone, HELP_MESSAGE)
  }

  await logSms(supabaseAdmin(), {
    userId,
    contactId: contact.id,
    conversationId: conversation.id,
    direction: 'inbound',
    phone: senderPhone,
    body: content,
    messageId: messageId ?? null,
    status: keyword ? `received:${keyword}` : 'received',
  })

  // A STOP message must never trigger marketing automations.
  if (keyword === 'stop') return

  const triggers: (
    | 'new_contact_created'
    | 'first_inbound_message'
    | 'new_message_received'
    | 'keyword_match'
  )[] = ['new_message_received', 'keyword_match']
  if (contact.wasCreated) triggers.unshift('new_contact_created')
  if (isFirstInboundMessage) triggers.unshift('first_inbound_message')
  for (const triggerType of triggers) {
    runAutomationsForTrigger({
      userId,
      triggerType,
      contactId: contact.id,
      context: { message_text: content, conversation_id: conversation.id },
    }).catch((err) =>
      console.error('[sms-webhook] automation dispatch failed:', err)
    )
  }
}

/**
 * Send a compliance auto-reply (STOP / START / HELP) through the
 * gateway. This deliberately bypasses the consent gate — a final
 * opt-out confirmation is permitted even after the contact opts out.
 */
async function sendAutoReply(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  to: string,
  text: string
): Promise<void> {
  try {
    const provider = providerFromConfigRow(config)
    await provider.sendText({ to, text })
  } catch (err) {
    console.error('[sms-webhook] auto-reply send failed:', err)
  }
}

async function findOrCreateContact(
  userId: string,
  phone: string
): Promise<{ id: string; unread_count?: number; wasCreated: boolean } | null> {
<<<<<<< HEAD
=======
  const { data: exact, error: exactError } = await supabaseAdmin()
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .eq('phone_normalized', phone)
    .maybeSingle()
  if (exactError) {
    console.error('[sms-webhook] contact lookup failed:', exactError)
    return null
  }
  if (exact) return { ...exact, wasCreated: false }

>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)
  const { data: contacts, error } = await supabaseAdmin()
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
<<<<<<< HEAD
=======
    .is('phone_normalized', null)
>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)
  if (error) {
    console.error('[sms-webhook] contact fetch failed:', error)
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = contacts?.find((c: any) => phonesMatch(c.phone, phone))
  if (existing) return { ...existing, wasCreated: false }

  const { data: created, error: createError } = await supabaseAdmin()
    .from('contacts')
<<<<<<< HEAD
    .insert({ user_id: userId, phone, name: phone })
=======
    .insert({ user_id: userId, phone, phone_normalized: phone, name: phone })
>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)
    .select()
    .single()
  if (createError) {
    console.error('[sms-webhook] contact create failed:', createError)
    return null
  }
  return { ...created, wasCreated: true }
}

async function findOrCreateConversation(userId: string, contactId: string) {
  const { data: existing, error } = await supabaseAdmin()
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .maybeSingle()
  if (!error && existing) return existing

  const { data: created, error: createError } = await supabaseAdmin()
    .from('conversations')
    .insert({ user_id: userId, contact_id: contactId })
    .select()
<<<<<<< HEAD
    .single()
  if (createError) {
    console.error('[sms-webhook] conversation create failed:', createError)
    return null
  }
  return created
=======
    .maybeSingle()
  if (!createError && created) return created

  if (createError) {
    console.error(
      '[sms-webhook] conversation create failed, retrying read:',
      createError
    )
  }

  const { data: retry, error: retryError } = await supabaseAdmin()
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .maybeSingle()
  if (retryError || !retry) {
    if (retryError) {
      console.error('[sms-webhook] conversation re-read failed:', retryError)
    }
    return null
  }
  return retry
>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)
}

async function flagBroadcastReplyIfAny(userId: string, contactId: string) {
  try {
    const { data: recs, error } = await supabaseAdmin()
      .from('broadcast_recipients')
      .select('id, broadcasts!inner(user_id)')
      .eq('contact_id', contactId)
      .eq('broadcasts.user_id', userId)
      .in('status', ['sent', 'delivered', 'read'])
      .order('created_at', { ascending: false })
      .limit(1)
    if (error || !recs || recs.length === 0) return

    await supabaseAdmin()
      .from('broadcast_recipients')
      .update({ status: 'replied', replied_at: new Date().toISOString() })
      .eq('id', recs[0].id)
  } catch (err) {
    console.error('[sms-webhook] flagBroadcastReplyIfAny failed:', err)
  }
}
<<<<<<< HEAD
=======

>>>>>>> 4c2e409 (Guns2Ammo Phase 1 SMS compliance + preflight + deploy runbook)
