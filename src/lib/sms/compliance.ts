/**
 * SMS compliance helpers — consent gating, opt-out keywords, quiet
 * hours, and audit logging.
 *
 * These exist to keep tenants on the right side of the TCPA and the US
 * carrier messaging rules:
 *   - Marketing/automated SMS may only go to contacts with recorded
 *     express consent.
 *   - STOP must be honored immediately; HELP must return help text.
 *   - Sending is blocked during the tenant's quiet hours.
 *   - Every send and receive is written to an append-only audit log.
 *
 * The functions accept any Supabase client (a user-scoped server client
 * or the service-role admin client) so both the send route and the
 * inbound webhook can use them.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>

// Carrier-recognized opt-out / opt-in / help keywords.
export const STOP_KEYWORDS = [
  'STOP',
  'STOPALL',
  'UNSUBSCRIBE',
  'CANCEL',
  'END',
  'QUIT',
  'OPTOUT',
]
export const START_KEYWORDS = ['START', 'UNSTOP', 'YES', 'OPTIN']
export const HELP_KEYWORDS = ['HELP', 'INFO']

export type SmsKeyword = 'stop' | 'start' | 'help' | null

/** Default auto-replies. Tenants can override these in a later phase. */
export const STOP_CONFIRM_MESSAGE =
  'You are unsubscribed and will receive no further messages. Reply START to opt back in.'
export const START_CONFIRM_MESSAGE =
  'You are subscribed again. Reply HELP for help, STOP to unsubscribe.'
export const HELP_MESSAGE =
  'Automated messaging service. Reply STOP to unsubscribe. Msg & data rates may apply.'

/**
 * Classify an inbound message by its first word. Carriers key opt-out
 * handling off the leading keyword, so we do the same — this avoids
 * false positives from the word appearing mid-sentence.
 */
export function classifyKeyword(text: string): SmsKeyword {
  const firstWord = text.trim().split(/\s+/)[0]?.toUpperCase() ?? ''
  if (!firstWord) return null
  if (STOP_KEYWORDS.includes(firstWord)) return 'stop'
  if (START_KEYWORDS.includes(firstWord)) return 'start'
  if (HELP_KEYWORDS.includes(firstWord)) return 'help'
  return null
}

export interface ConsentRow {
  id: string
  status: 'pending' | 'opted_in' | 'opted_out'
  age_confirmed: boolean
  legal_text_version?: string | null
}

export async function getConsent(
  db: Db,
  contactId: string
): Promise<ConsentRow | null> {
  const { data } = await db
    .from('sms_consent')
    .select('id, status, age_confirmed, legal_text_version')
    .eq('contact_id', contactId)
    .maybeSingle()
  return (data as ConsentRow | null) ?? null
}

export interface SendDecision {
  allowed: boolean
  reason?: string
}

/**
 * Whether an outbound SMS to this contact is permitted. A contact must
 * have an explicit `opted_in` consent record — no record, a `pending`
 * record, or an `opted_out` record all block the send.
 */
export async function isSendAllowed(
  db: Db,
  contactId: string
): Promise<SendDecision> {
  const consent = await getConsent(db, contactId)
  if (!consent) {
    return { allowed: false, reason: 'no recorded SMS consent for this contact' }
  }
  if (consent.status === 'opted_out') {
    return { allowed: false, reason: 'contact has opted out of SMS' }
  }
  if (consent.status !== 'opted_in') {
    return { allowed: false, reason: 'SMS consent is not confirmed' }
  }
  return { allowed: true }
}

/** Mark a contact opted out (STOP). Idempotent upsert on contact_id. */
export async function setOptOut(
  db: Db,
  userId: string,
  contactId: string,
  opts: {
    source?: string
    ip?: string
    userAgent?: string
    details?: Record<string, unknown>
  } = {}
): Promise<void> {
  const now = new Date().toISOString()
  await db.from('sms_consent').upsert(
    {
      user_id: userId,
      contact_id: contactId,
      status: 'opted_out',
      opt_out_source: opts.source ?? 'keyword',
      opted_out_at: now,
      updated_at: now,
    },
    { onConflict: 'contact_id' }
  )
  await logConsentEvent(db, {
    userId,
    contactId,
    action: opts.source === 'keyword' ? 'stop' : 'opt_out',
    source: opts.source ?? 'keyword',
    ip: opts.ip,
    userAgent: opts.userAgent,
    details: opts.details,
  })
}

/** Mark a contact opted in. Used by the consent API and the START keyword. */
export async function setOptIn(
  db: Db,
  userId: string,
  contactId: string,
  opts: {
    source?: string
    ip?: string
    ageConfirmed?: boolean
    userAgent?: string
    legalTextVersion?: string
    details?: Record<string, unknown>
  } = {}
): Promise<void> {
  const now = new Date().toISOString()
  await db.from('sms_consent').upsert(
    {
      user_id: userId,
      contact_id: contactId,
      status: 'opted_in',
      opted_in_at: now,
      opt_in_source: opts.source ?? 'keyword',
      opt_in_ip: opts.ip ?? null,
      opt_in_user_agent: opts.userAgent ?? null,
      legal_text_version: opts.legalTextVersion ?? null,
      age_confirmed: opts.ageConfirmed ?? false,
      opted_out_at: null,
      opt_out_source: null,
      updated_at: now,
    },
    { onConflict: 'contact_id' }
  )
  await logConsentEvent(db, {
    userId,
    contactId,
    action: opts.source === 'keyword' ? 'start' : 'opt_in',
    source: opts.source ?? 'keyword',
    ip: opts.ip,
    userAgent: opts.userAgent,
    legalTextVersion: opts.legalTextVersion,
    details: opts.details,
  })
}

export type SmsMessageCategory = 'transactional' | 'support' | 'marketing'

export interface SmsPolicyDecision {
  allowed: boolean
  reasons: string[]
  messageCategory: SmsMessageCategory
}

export interface SmsPolicyInput {
  consent: ConsentRow | null
  messageCategory: SmsMessageCategory
  provider: 'jasmin' | 'meta' | 'twilio'
  inQuietHours: boolean
  allowFflMarketing?: boolean
}

/**
 * Phase-1 Guns2Ammo policy gate.
 * For jasmin (SMS):
 * - consent must be opted_in
 * - quiet hours must be respected
 * - marketing is blocked unless explicitly enabled
 */
export function evaluateSmsPolicy(input: SmsPolicyInput): SmsPolicyDecision {
  const reasons: string[] = []

  if (input.provider !== 'jasmin') {
    return {
      allowed: true,
      reasons,
      messageCategory: input.messageCategory,
    }
  }

  if (!input.consent) {
    reasons.push('no recorded SMS consent for this contact')
  } else if (input.consent.status === 'opted_out') {
    reasons.push('contact has opted out of SMS')
  } else if (input.consent.status !== 'opted_in') {
    reasons.push('SMS consent is not confirmed')
  }

  if (input.inQuietHours) {
    reasons.push('outside the allowed sending hours (quiet hours)')
  }

  if (input.messageCategory === 'marketing' && !input.allowFflMarketing) {
    reasons.push('marketing SMS is disabled for Guns2Ammo Phase 1')
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    messageCategory: input.messageCategory,
  }
}

interface QuietHoursConfig {
  sms_quiet_hours_start?: number | null
  sms_quiet_hours_end?: number | null
  sms_timezone?: string | null
}

/**
 * Whether the tenant's local time is currently inside its configured
 * quiet-hours window. A NULL start or end disables the check. The
 * window may wrap past midnight (e.g. 21 → 8).
 */
export function isWithinQuietHours(
  config: QuietHoursConfig,
  now: Date = new Date()
): boolean {
  const start = config.sms_quiet_hours_start
  const end = config.sms_quiet_hours_end
  if (start == null || end == null) return false

  const tz = config.sms_timezone || 'America/New_York'
  let hour: number
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: tz,
      }).format(now)
    )
  } catch {
    // Unknown timezone — fall back to UTC rather than silently allowing.
    hour = now.getUTCHours()
  }
  // %24 guards the Intl quirk where midnight can format as "24".
  hour = hour % 24

  return start <= end
    ? hour >= start && hour < end
    : hour >= start || hour < end
}

export interface SmsAuditEntry {
  userId: string
  contactId?: string | null
  conversationId?: string | null
  direction: 'outbound' | 'inbound'
  phone: string
  body?: string | null
  messageId?: string | null
  status?: string | null
  blockReason?: string | null
}

export interface SmsConsentEvent {
  userId: string
  contactId: string
  action: 'opt_in' | 'opt_out' | 'help' | 'start' | 'stop'
  source?: string | null
  legalTextVersion?: string | null
  ip?: string | null
  userAgent?: string | null
  details?: Record<string, unknown>
}

/** Append-only consent event ledger entry. Best-effort â€” never throws. */
export async function logConsentEvent(
  db: Db,
  event: SmsConsentEvent
): Promise<void> {
  try {
    await db.from('sms_consent_events').insert({
      user_id: event.userId,
      contact_id: event.contactId,
      action: event.action,
      source: event.source ?? null,
      legal_text_version: event.legalTextVersion ?? null,
      evidence_ip: event.ip ?? null,
      evidence_user_agent: event.userAgent ?? null,
      details: event.details ?? null,
    })
  } catch (err) {
    console.error('[sms/compliance] consent event write failed:', err)
  }
}

/** Append a row to the SMS audit log. Best-effort — never throws. */
export async function logSms(db: Db, entry: SmsAuditEntry): Promise<void> {
  try {
    await db.from('sms_audit_log').insert({
      user_id: entry.userId,
      contact_id: entry.contactId ?? null,
      conversation_id: entry.conversationId ?? null,
      direction: entry.direction,
      phone: entry.phone,
      body: entry.body ?? null,
      message_id: entry.messageId ?? null,
      status: entry.status ?? null,
      block_reason: entry.blockReason ?? null,
    })
  } catch (err) {
    console.error('[sms/compliance] audit log write failed:', err)
  }
}
