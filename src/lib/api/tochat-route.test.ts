import { describe, expect, it, vi } from 'vitest'

// requireTochatScope composes requireOrgId (auth + org) with
// resolveTochatScope (credentials). Mock both so the unconfigured
// branch can be exercised without Supabase or provider credentials.

vi.mock('./require-org-id', () => ({
  requireOrgId: vi.fn(async () => ({
    orgId: 'org-1',
    supabase: { from: () => { throw new Error('not expected') } },
    error: null,
  })),
}))

vi.mock('../tochat/org-config', () => ({
  resolveTochatScope: vi.fn(async () => null),
}))

import { requireTochatScope } from './tochat-route'

describe('requireTochatScope unconfigured handling', () => {
  it('returns HTTP 200 { configured: false } for list routes', async () => {
    const { error } = await requireTochatScope()
    expect(error).not.toBeNull()
    expect(error!.status).toBe(200)
    await expect(error!.json()).resolves.toEqual({ configured: false })
  })

  it('returns HTTP 409 with an actionable error for action routes', async () => {
    const { error } = await requireTochatScope({ action: true })
    expect(error).not.toBeNull()
    expect(error!.status).toBe(409)
    const body = await error!.json()
    expect(body.configured).toBe(false)
    expect(body.error).toMatch(/Settings → Chatbotistic/)
  })
})
