/**
 * Twilio inbound webhook.
 *
 * Twilio POSTs `application/x-www-form-urlencoded` to this single URL for
 * both inbound WhatsApp messages and message-status callbacks. The org's
 * Twilio config is located by `AccountSid`, the request is authenticated
 * with `verifyTwilioSignature` against that org's decrypted auth token,
 * and the payload is routed to the message or status handler.
 *
 * Configure this URL in the Twilio Console:
 *   - Messaging → your WhatsApp sender → "When a message comes in"
 *   - (optionally) the same URL as the status callback
 * It must be the public HTTPS URL, e.g.
 *   https://crm.example.com/api/whatsapp/twilio-webhook
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'
import { verifyTwilioSignature } from '@/lib/whatsapp/twilio-signature'
import { normalizePhone, phonesMatch } from '@/lib/whatsapp/phone-utils'
import { runAutomationsForTrigger } from '@/lib/automations/engine'

// Empty TwiML — tells Twilio "received, send no auto-reply".
const TWIML_OK =
  '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
function twimlResponse(status = 200) {
  return new Response(status === 200 ? TWIML_OK : '', {
    status,
    headers: { 'Content-Type': 'text/xml' },
  })
}

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

/** Strip Twilio's `whatsapp:` (or `sms:`) channel prefix from an address. */
function stripChannel(address: string): string {
  return address.replace(/^(whatsapp|sms):/i, '').trim()
}

/**
 * Candidate absolute URLs Twilio may have signed. Twilio's signature is
 * bound to the exact callback URL, so we try the canonical site URL
 * first, then a proxy-header reconstruction.
 */
function candidateUrls(request: Request): string[] {
  const path = '/api/whatsapp/twilio-webhook'
  const urls: string[] = []

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (site) urls.push(site + path)

  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (host) {
    const reconstructed = `${proto}://${host}${path}`
    if (!urls.includes(reconstructed)) urls.push(reconstructed)
  }

  // The raw request URL, last resort (often an internal host behind a proxy).
  if (!urls.includes(request.url)) urls.push(request.url)
  return urls
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const params: Record<string, string> = {}
  for (const [key, value] of new URLSearchParams(rawBody)) {
    params[key] = value
  }

  const accountSid = params.AccountSid
  if (!accountSid) {
    return NextResponse.json({ error: 'Missing AccountSid' }, { status: 400 })
  }

  // Locate the org whose Twilio config owns this account. When several
  // configs share an account, prefer the one whose sender matches `To`.
  const { data: configs, error: configError } = await supabaseAdmin()
    .from('whatsapp_config')
    .select('*')
    .eq('provider', 'twilio')
    .eq('twilio_account_sid', accountSid)

  if (configError || !configs || configs.length === 0) {
    console.error('[twilio-webhook] no config for AccountSid:', accountSid)
    // 200 so Twilio doesn't retry forever on an unknown account.
    return twimlResponse(200)
  }

  const toNumber = params.To ? stripChannel(params.To) : ''
  const config =
    configs.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) =>
        c.twilio_whatsapp_number &&
        phonesMatch(c.twilio_whatsapp_number, toNumber)
    ) ?? configs[0]

  let authToken: string
  try {
    authToken = decrypt(config.twilio_auth_token)
  } catch (err) {
    console.error('[twilio-webhook] auth token decryption failed:', err)
    return twimlResponse(200)
  }

  // Authenticate the request against Twilio's signature.
  const signature = request.headers.get('x-twilio-signature')
  const signatureOk = candidateUrls(request).some((url) =>
    verifyTwilioSignature({ authToken, signatureHeader: signature, url, params })
  )
  if (!signatureOk) {
    console.warn('[twilio-webhook] rejected request with invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  try {
    if (params.MessageStatus || params.SmsStatus) {
      await handleStatusCallback(params)
    } else if (params.From && (params.Body || Number(params.NumMedia ?? '0') > 0)) {
      await handleInboundMessage(config.user_id, params)
    }
  } catch (err) {
    console.error('[twilio-webhook] processing error:', err)
    // Still ack — a 500 just makes Twilio retry the same failing payload.
  }

  return twimlResponse(200)
}

// Twilio delivery states mapped onto the messages.status CHECK constraint
// ('sending','sent','delivered','read','failed').
function mapTwilioStatus(status: string): string | null {
  switch (status) {
    case 'queued':
    case 'sending':
    case 'accepted':
    case 'scheduled':
      return 'sending'
    case 'sent':
      return 'sent'
    case 'delivered':
      return 'delivered'
    case 'read':
      return 'read'
    case 'failed':
    case 'undelivered':
      return 'failed'
    default:
      return null
  }
}

// Forward-only ladder for broadcast_recipients, mirroring the Meta webhook.
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

async function handleStatusCallback(params: Record<string, string>) {
  const messageSid = params.MessageSid || params.SmsSid
  const rawStatus = params.MessageStatus || params.SmsStatus
  if (!messageSid || !rawStatus) return

  const mapped = mapTwilioStatus(rawStatus)
  if (!mapped) return

  const { error: msgErr } = await supabaseAdmin()
    .from('messages')
    .update({ status: mapped })
    .eq('message_id', messageSid)
  if (msgErr) console.error('[twilio-webhook] message status update failed:', msgErr)

  // Mirror onto broadcast_recipients so broadcast counts re-derive.
  const { data: recipient, error: recErr } = await supabaseAdmin()
    .from('broadcast_recipients')
    .select('id, status')
    .eq('whatsapp_message_id', messageSid)
    .maybeSingle()
  if (recErr || !recipient) return

  if (!isForwardTransition(recipient.status, mapped)) return

  const nowIso = new Date().toISOString()
  const update: Record<string, unknown> = { status: mapped }
  if (mapped === 'sent') update.sent_at = nowIso
  if (mapped === 'delivered') update.delivered_at = nowIso
  if (mapped === 'read') update.read_at = nowIso

  const { error: recUpdErr } = await supabaseAdmin()
    .from('broadcast_recipients')
    .update(update)
    .eq('id', recipient.id)
  if (recUpdErr)
    console.error('[twilio-webhook] recipient status update failed:', recUpdErr)
}

// messages.content_type CHECK allows: text,image,document,audio,video,location,template
function mapContentType(twilioMime?: string): string {
  if (!twilioMime) return 'text'
  if (twilioMime.startsWith('image/')) return 'image'
  if (twilioMime.startsWith('video/')) return 'video'
  if (twilioMime.startsWith('audio/')) return 'audio'
  return 'document'
}

async function handleInboundMessage(
  userId: string,
  params: Record<string, string>
) {
  const senderPhone = normalizePhone(stripChannel(params.From))
  const profileName = params.ProfileName || senderPhone
  const messageSid = params.MessageSid || params.SmsSid
  const numMedia = Number(params.NumMedia ?? '0')

  // Twilio media URLs require account auth to fetch, so they can't be
  // rendered directly in the inbox without a proxy. Until one exists we
  // record the type and URL; text content is captured fully.
  const mediaContentType = params.MediaContentType0
  const mediaUrl = numMedia > 0 ? params.MediaUrl0 || null : null
  const contentType = numMedia > 0 ? mapContentType(mediaContentType) : 'text'
  const contentText = params.Body || (numMedia > 0 ? null : '')

  const contact = await findOrCreateContact(userId, senderPhone, profileName)
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
    content_type: contentType,
    content_text: contentText,
    media_url: mediaUrl,
    message_id: messageSid,
    status: 'delivered',
    created_at: new Date().toISOString(),
  })
  if (msgError) {
    console.error('[twilio-webhook] message insert failed:', msgError)
    return
  }

  await supabaseAdmin()
    .from('conversations')
    .update({
      last_message_text: contentText || `[${contentType}]`,
      last_message_at: new Date().toISOString(),
      unread_count: (conversation.unread_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id)

  await flagBroadcastReplyIfAny(userId, contact.id)

  // Dispatch automations — fire-and-forget so a slow automation never
  // delays the webhook ack.
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
      context: {
        message_text: params.Body ?? '',
        conversation_id: conversation.id,
      },
    }).catch((err) => console.error('[twilio-webhook] automation dispatch failed:', err))
  }
}

async function findOrCreateContact(
  userId: string,
  phone: string,
  name: string
): Promise<{ id: string; unread_count?: number; wasCreated: boolean } | null> {
  const { data: contacts, error } = await supabaseAdmin()
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
  if (error) {
    console.error('[twilio-webhook] contact fetch failed:', error)
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = contacts?.find((c: any) => phonesMatch(c.phone, phone))
  if (existing) {
    if (name && name !== existing.name) {
      await supabaseAdmin()
        .from('contacts')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    }
    return { ...existing, wasCreated: false }
  }

  const { data: created, error: createError } = await supabaseAdmin()
    .from('contacts')
    .insert({ user_id: userId, phone, name: name || phone })
    .select()
    .single()
  if (createError) {
    console.error('[twilio-webhook] contact create failed:', createError)
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
    console.error('[twilio-webhook] conversation create failed:', createError)
    return null
  }
  return created
}

/**
 * If the inbound sender is on an un-replied broadcast_recipients row,
 * flip it to `replied` so the broadcast's reply count advances.
 */
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
    console.error('[twilio-webhook] flagBroadcastReplyIfAny failed:', err)
  }
}
