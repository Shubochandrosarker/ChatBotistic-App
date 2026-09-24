import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  checkMonthlyMessageCap,
  limitMessage,
  limitReached,
  monthStart,
} from './entitlements'

describe('limitReached', () => {
  it('treats null and negative limits as unlimited', () => {
    expect(limitReached(null, 1000)).toBe(false)
    expect(limitReached(-1, 1000)).toBe(false)
  })

  it('blocks when the count has reached the limit', () => {
    expect(limitReached(1, 1)).toBe(true)
    expect(limitReached(1, 0)).toBe(false)
    expect(limitReached(100, 99)).toBe(false)
    expect(limitReached(100, 100)).toBe(true)
  })
})

describe('limitMessage', () => {
  it('names the plan and the limit when known', () => {
    expect(limitMessage('widget', { plan: 'Free Forever' }, 1)).toBe(
      'Your Free Forever plan allows 1 widget. Upgrade to add more.',
    )
  })

  it('falls back when the limit is an unlimited sentinel', () => {
    expect(limitMessage('agent', { plan: null }, -1)).toBe(
      'agent limit reached for your plan.',
    )
  })
})

describe('monthStart', () => {
  it('returns midnight UTC on the first of the current month', () => {
    expect(monthStart(new Date('2026-09-24T13:45:12.999Z'))).toBe('2026-09-01T00:00:00.000Z')
    expect(monthStart(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01T00:00:00.000Z')
  })

  it('rolls back across the year boundary', () => {
    expect(monthStart(new Date('2026-12-31T23:59:59.999Z'))).toBe('2026-12-01T00:00:00.000Z')
  })
})

/**
 * Minimal chainable stand-in for the Supabase query builder covering
 * exactly the shapes resolveOrgId / orgEntitlements /
 * outboundMessagesThisMonth build.
 */
function fakeSupabase(tables: {
  organizations?: { data: Record<string, unknown> | null }
  messages?: { count?: number; error?: { message: string } }
  broadcasts?: { data?: Array<{ sent_count: number }>; error?: { message: string } }
}) {
  type Thenable = Record<string, unknown> & {
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (v: unknown) => unknown) => Promise<unknown>
  }
  const chain = (result: Record<string, unknown>): Thenable => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      gte: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve(result),
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (v: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected),
    }
    return builder as Thenable
  }
  return {
    from(table: string) {
      if (table === 'organizations') return chain({ data: tables.organizations?.data ?? null })
      if (table === 'messages') {
        return chain({ count: tables.messages?.count ?? 0, error: tables.messages?.error ?? null })
      }
      return chain({ data: tables.broadcasts?.data ?? [], error: tables.broadcasts?.error ?? null })
    },
  }
}

/** The fake only implements from(); cast to the client type the
 *  production code expects. */
function asClient(tables: Parameters<typeof fakeSupabase>[0]): SupabaseClient {
  return fakeSupabase(tables) as unknown as SupabaseClient
}

const ORG_ROW = {
  id: 'org-1',
  plan: 'free',
  license_status: 'active',
  widget_limit: 1,
  agent_limit: 1,
  domain_limit: 1,
  seat_limit: 1,
  message_limit: 100,
  contact_limit: 50,
}

describe('checkMonthlyMessageCap', () => {
  it('does not enforce when the caller has no organization yet', async () => {
    const decision = await checkMonthlyMessageCap(asClient({ organizations: { data: null } }), 'user-1', 1)
    expect(decision).toEqual({ enforced: false, allowed: true })
  })

  it('allows a send that keeps usage within the cap', async () => {
    const supabase = asClient({
      organizations: { data: ORG_ROW },
      messages: { count: 99 },
      broadcasts: { data: [] },
    })
    const decision = await checkMonthlyMessageCap(supabase, 'user-1', 1)
    expect(decision.enforced).toBe(true)
    expect(decision.allowed).toBe(true)
    expect(decision.used).toBe(99)
  })

  it('blocks the send that would exceed the cap', async () => {
    const supabase = asClient({
      organizations: { data: ORG_ROW },
      messages: { count: 100 },
      broadcasts: { data: [] },
    })
    const decision = await checkMonthlyMessageCap(supabase, 'user-1', 1)
    expect(decision.allowed).toBe(false)
    expect(decision.limit).toBe(100)
    expect(decision.message).toContain('100 messages per month')
  })

  it('counts broadcast sends toward the cap and rejects a batch up front', async () => {
    const supabase = asClient({
      organizations: { data: ORG_ROW },
      messages: { count: 50 },
      broadcasts: { data: [{ sent_count: 45 }, { sent_count: 6 }] }, // 101 used
    })
    const decision = await checkMonthlyMessageCap(supabase, 'user-1', 10)
    expect(decision.allowed).toBe(false)
    expect(decision.used).toBe(101)
  })

  it('treats a negative limit as unlimited', async () => {
    const supabase = asClient({
      organizations: { data: { ...ORG_ROW, plan: 'agency', message_limit: -1 } },
      messages: { count: 10_000 },
      broadcasts: { data: [] },
    })
    const decision = await checkMonthlyMessageCap(supabase, 'user-1', 5)
    expect(decision.allowed).toBe(true)
  })

  it('fails closed when the usage counter errors', async () => {
    const supabase = asClient({
      organizations: { data: ORG_ROW },
      messages: { count: 0, error: { message: 'boom' } },
      broadcasts: { data: [] },
    })
    const decision = await checkMonthlyMessageCap(supabase, 'user-1', 1)
    expect(decision.allowed).toBe(false)
  })
})
