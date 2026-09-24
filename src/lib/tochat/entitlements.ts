// Plan-entitlement helpers for the white-label resources. The SSO
// bridge (src/lib/sso/provision.ts) and license activation
// (src/lib/licensing/service.ts) write the limits onto
// `organizations`; these are enforced at creation/send time here.
//
// Limit semantics (mirrors the WordPress bridge caps): null or any
// negative value = unlimited.

import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveOrgId } from '@/lib/supabase/org'

export interface OrgEntitlements {
  plan: string | null
  license_status: string | null
  widget_limit: number | null
  agent_limit: number | null
  domain_limit: number | null
  seat_limit: number | null
  message_limit: number | null
  contact_limit: number | null
}

/**
 * Fail-closed defaults used when the entitlement row cannot be read:
 * the most restrictive known tier (Free), never unlimited.
 */
export const RESTRICTIVE_DEFAULTS: OrgEntitlements = {
  plan: null,
  license_status: null,
  widget_limit: 1,
  agent_limit: 1,
  domain_limit: 1,
  seat_limit: 1,
  message_limit: 100,
  contact_limit: 50,
}

export async function orgEntitlements(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OrgEntitlements> {
  const { data, error } = await supabase
    .from('organizations')
    .select(
      'plan, license_status, widget_limit, agent_limit, domain_limit, seat_limit, message_limit, contact_limit',
    )
    .eq('id', orgId)
    .maybeSingle()
  if (error || !data) {
    // Entitlement lookup failing must never widen access — treat as
    // the most restrictive known default rather than unlimited.
    console.error(`[tochat] entitlement lookup failed for org ${orgId}:`, error?.message)
    return { ...RESTRICTIVE_DEFAULTS }
  }
  return {
    plan: (data.plan as string | null) ?? null,
    license_status: (data.license_status as string | null) ?? null,
    widget_limit: data.widget_limit ?? null,
    agent_limit: data.agent_limit ?? null,
    domain_limit: data.domain_limit ?? null,
    seat_limit: data.seat_limit ?? null,
    message_limit: data.message_limit ?? null,
    contact_limit: data.contact_limit ?? null,
  }
}

/** null/negative = unlimited; otherwise true when count >= limit. */
export function limitReached(limit: number | null | undefined, count: number): boolean {
  if (limit == null || limit < 0) return false
  return count >= limit
}

/**
 * Upgrade CTA message for a plan-cap rejection, matching the
 * widget/agent limit responses.
 */
export function limitMessage(
  kind: string,
  entitlements: Pick<OrgEntitlements, 'plan'>,
  limit: number | null | undefined,
): string {
  if (limit != null && limit >= 0) {
    return `Your ${entitlements.plan ?? 'current'} plan allows ${limit} ${kind}. Upgrade to add more.`
  }
  return `${kind} limit reached for your plan.`
}

/**
 * First instant of the current UTC month — the billing boundary the
 * monthly message allowance resets at.
 */
export function monthStart(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

/**
 * Outbound messages this calendar month for one user:
 *
 *   - inbox sends: `messages` rows with sender_type agent/bot, scoped
 *     through the conversation's user_id (messages themselves have no
 *     user column — the embed filter + RLS both scope them);
 *   - campaign sends: sum of `broadcasts.sent_count` for campaigns
 *     created this month (broadcast fan-out doesn't write messages
 *     rows — recipients may not even have conversations yet).
 *
 * Provider retries and webhook replays insert nothing, so they are not
 * double-counted.
 */
export async function outboundMessagesThisMonth(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const since = monthStart(now)
  const [messagesResult, broadcastsResult] = await Promise.all([
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('sender_type', ['agent', 'bot'])
      .eq('conversation.user_id', userId)
      .gte('created_at', since),
    supabase
      .from('broadcasts')
      .select('sent_count')
      .eq('user_id', userId)
      .gte('created_at', since),
  ])
  if (messagesResult.error || broadcastsResult.error) {
    console.error(
      '[entitlements] outbound message count failed:',
      messagesResult.error?.message ?? broadcastsResult.error?.message,
    )
    // Fail closed: report the cap as reached rather than let a broken
    // counter silently widen the plan allowance.
    return Number.MAX_SAFE_INTEGER
  }
  const campaignSends = (broadcastsResult.data ?? []).reduce(
    (total, row) => total + (Number(row.sent_count) || 0),
    0,
  )
  return (messagesResult.count ?? 0) + campaignSends
}

export interface MessageCapDecision {
  /** False when the caller has no organization yet — the per-user CRM
   *  predates orgs, so those accounts keep legacy behavior. */
  enforced: boolean
  allowed: boolean
  limit?: number
  used?: number
  message?: string
}

/**
 * Server-side enforcement of the plan's monthly message allowance.
 * `pendingCount` is the size of the batch about to be sent (1 for an
 * inbox send, recipients.length for a broadcast) so a campaign that
 * would blow past the cap is rejected before the first send, not
 * halfway through.
 */
export async function checkMonthlyMessageCap(
  supabase: SupabaseClient,
  userId: string,
  pendingCount: number,
): Promise<MessageCapDecision> {
  const orgId = await resolveOrgId(supabase)
  if (!orgId) return { enforced: false, allowed: true }

  const entitlements = await orgEntitlements(supabase, orgId)
  const used = await outboundMessagesThisMonth(supabase, userId)
  const limit = entitlements.message_limit
  const projected = used + Math.max(1, pendingCount)
  if (limit == null || limit < 0 || projected <= limit) {
    return { enforced: true, allowed: true, limit: limit ?? undefined, used }
  }
  return {
    enforced: true,
    allowed: false,
    limit,
    used,
    message: `Your ${entitlements.plan ?? 'current'} plan includes ${limit} messages per month and ${used} have been used. Upgrade your plan to keep sending.`,
  }
}
