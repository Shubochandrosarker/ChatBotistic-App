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
import { runAutomationsForTrigger } from '@/lib/automations/engine'

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

function authorized(params: Record<string, string>): boolean {
  const secret = process.env.SMS_WEBHOOK_SECRET
  if (!secret) {
    console.error('[sms-webhook] SMS_WEBHOOK_SECRET is not set — rejecting')
    return false
  }
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

  if (!authorized(params)) {
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
    .select('user_id, jasmin_default_sender')
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

async function findOrCreateContact(
  userId: string,
  phone: string
): Promise<{ id: string; unread_count?: number; wasCreated: boolean } | null> {
  const { data: contacts, error } = await supabaseAdmin()
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
  if (error) {
    console.error('[sms-webhook] contact fetch failed:', error)
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = contacts?.find((c: any) => phonesMatch(c.phone, phone))
  if (existing) return { ...existing, wasCreated: false }

  const { data: created, error: createError } = await supabaseAdmin()
    .from('contacts')
    .insert({ user_id: userId, phone, name: phone })
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
    .single()
  if (createError) {
    console.error('[sms-webhook] conversation create failed:', createError)
    return null
  }
  return created
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
