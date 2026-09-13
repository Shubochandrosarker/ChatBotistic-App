import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** A shared-master-account scope (tag-scoped inside one account). */
async function sharedScope() {
  const { normalizeTochatBase } = await import('./client')
  return {
    orgId: 'org-uuid-1',
    mode: 'shared' as const,
    email: 'master@example.com',
    password: 'secret',
    base: normalizeTochatBase(null),
    userClient: 'org-abc',
  }
}

/** An isolated scope — the org's own white-label account. */
async function isolatedScope() {
  const { normalizeTochatBase } = await import('./client')
  return {
    orgId: 'org-uuid-2',
    mode: 'isolated' as const,
    email: 'customer@example.com',
    password: 'their-secret',
    base: normalizeTochatBase(null),
    userClient: null,
  }
}

describe('tochat client', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  it('logs in once, caches the token per account, and scopes the shared-mode widget list by userClient', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-1' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { 'hydra:member': [{ id: 'w1', name: 'Sales' }] }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { 'hydra:member': [{ id: 'w2', name: 'Support' }] }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { widgets } = await import('./client')
    const scope = await sharedScope()
    const first = await widgets.list(scope)
    const second = await widgets.list(scope)

    expect(first).toEqual([{ id: 'w1', name: 'Sales' }])
    expect(second).toEqual([{ id: 'w2', name: 'Support' }])
    // 1 login + 2 list calls — the second list reused the cached token.
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][0]).toContain('/api/authentication_token')
    expect(fetchMock.mock.calls[1][0]).toContain('userClient%5B%5D=org-abc')
  })

  it('isolated-mode lists carry NO userClient tag — the account JWT is the only scope', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-cust' }))
      .mockResolvedValueOnce(jsonResponse(200, { 'hydra:member': [{ id: 'w9' }] }))
    vi.stubGlobal('fetch', fetchMock)

    const { widgets } = await import('./client')
    const scope = await isolatedScope()
    await widgets.list(scope)

    expect(fetchMock.mock.calls[1][0]).not.toContain('userClient')
  })

  it('isolated-mode creates do not stamp a userClient onto the payload', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-cust' }))
      .mockResolvedValueOnce(jsonResponse(201, { id: 'w10', name: 'X' }))
    vi.stubGlobal('fetch', fetchMock)

    const { widgets } = await import('./client')
    const scope = await isolatedScope()
    await widgets.create(scope, { name: 'X' })

    const sentBody = JSON.parse((fetchMock.mock.calls[1][1]?.body as string) ?? '{}')
    expect(sentBody).not.toHaveProperty('userClient')
  })

  it('shared-mode creates stamp the org tag onto the payload', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-1' }))
      .mockResolvedValueOnce(jsonResponse(201, { id: 'w11', name: 'Y' }))
    vi.stubGlobal('fetch', fetchMock)

    const { widgets } = await import('./client')
    const scope = await sharedScope()
    await widgets.create(scope, { name: 'Y' })

    const sentBody = JSON.parse((fetchMock.mock.calls[1][1]?.body as string) ?? '{}')
    expect(sentBody.userClient).toBe('org-abc')
  })

  it('keeps tokens separate per account (isolated and master never share a cache slot)', async () => {
    const fetchMock = vi
      .fn()
      // isolated login + list
      .mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-cust' }))
      .mockResolvedValueOnce(jsonResponse(200, { 'hydra:member': [] }))
      // master login + list (must log in again — different account)
      .mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-master' }))
      .mockResolvedValueOnce(jsonResponse(200, { 'hydra:member': [] }))
    vi.stubGlobal('fetch', fetchMock)

    const { widgets } = await import('./client')
    await widgets.list(await isolatedScope())
    await widgets.list(await sharedScope())

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[2][0]).toContain('/api/authentication_token')
  })

  it('clears the cached token and retries once on a 401, carrying the fresh token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-expired' }))
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'Expired JWT Token' }))
      .mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-fresh' }))
      .mockResolvedValueOnce(jsonResponse(200, { 'hydra:member': [] }))
    vi.stubGlobal('fetch', fetchMock)

    const { widgets } = await import('./client')
    const scope = await sharedScope()
    const result = await widgets.list(scope)

    expect(result).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(4)
    // The first list attempt (call 2) carried the now-expired token...
    expect(fetchMock.mock.calls[1][1]?.headers?.Authorization).toBe('Bearer jwt-expired')
    // ...and the retried list attempt (call 4) carried the freshly-issued one.
    expect(fetchMock.mock.calls[3][0]).not.toContain('/api/authentication_token')
    expect(fetchMock.mock.calls[3][1]?.headers?.Authorization).toBe('Bearer jwt-fresh')
  })

  it('gives up after a second consecutive 401 instead of retrying forever', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-1' }))
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'Expired JWT Token' }))
      .mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-2' }))
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'Expired JWT Token' }))
    vi.stubGlobal('fetch', fetchMock)

    const { widgets } = await import('./client')
    const scope = await sharedScope()
    await expect(widgets.list(scope)).rejects.toMatchObject({
      name: 'TochatApiError',
      status: 401,
    })
    // 2 logins + 2 list attempts — exactly one retry, no unbounded loop.
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('surfaces a non-2xx response as a TochatApiError with the API message', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-1' }))
      .mockResolvedValueOnce(
        jsonResponse(422, { violations: [{ message: '`name` is required' }] }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { widgets } = await import('./client')
    const scope = await sharedScope()
    await expect(widgets.create(scope, {})).rejects.toMatchObject({
      name: 'TochatApiError',
      status: 422,
      message: '`name` is required',
    })
  })

  it('verifyTochatLogin throws a 401 TochatApiError on bad credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { code: 401, message: 'Invalid credentials.' }))
    vi.stubGlobal('fetch', fetchMock)

    const { verifyTochatLogin } = await import('./client')
    await expect(
      verifyTochatLogin('x@example.com', 'wrong', 'https://app.chatbotistic.com'),
    ).rejects.toMatchObject({ name: 'TochatApiError', status: 401 })
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://services.tochat.be/api/authentication_token',
    )
  })

  it('verifyTochatLogin resolves when the API returns a token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { token: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    const { verifyTochatLogin } = await import('./client')
    await expect(
      verifyTochatLogin('x@example.com', 'right'),
    ).resolves.toBeUndefined()
  })
})

describe('tochatUserClientForOrg / tochatUserClientForWpUser', () => {
  it('derives deterministic tags', async () => {
    const { tochatUserClientForOrg, tochatUserClientForWpUser } = await import('./org')
    expect(tochatUserClientForOrg('abc-123')).toBe('org-abc-123')
    expect(tochatUserClientForWpUser(42)).toBe('cbc-42')
    expect(tochatUserClientForWpUser('77')).toBe('cbc-77')
  })
})

describe('resourceIdFromIri', () => {
  it('extracts the trailing segment from a plain IRI string', async () => {
    const { resourceIdFromIri } = await import('./client')
    expect(resourceIdFromIri('/api/v2/widgets/abc-123')).toBe('abc-123')
  })

  it('strips trailing slashes before extracting the id', async () => {
    const { resourceIdFromIri } = await import('./client')
    expect(resourceIdFromIri('/api/v2/widgets/abc-123/')).toBe('abc-123')
  })

  it('reads `id` off an embedded relation object', async () => {
    const { resourceIdFromIri } = await import('./client')
    expect(resourceIdFromIri({ id: 'abc-123', '@id': '/api/v2/widgets/abc-123' })).toBe('abc-123')
  })

  it('falls back to `@id` when an embedded object has no `id`', async () => {
    const { resourceIdFromIri } = await import('./client')
    expect(resourceIdFromIri({ '@id': '/api/v2/widgets/abc-123' })).toBe('abc-123')
  })

  it('returns null for unrecognized shapes rather than throwing', async () => {
    const { resourceIdFromIri } = await import('./client')
    expect(resourceIdFromIri(null)).toBeNull()
    expect(resourceIdFromIri(undefined)).toBeNull()
    expect(resourceIdFromIri(42)).toBeNull()
    expect(resourceIdFromIri({})).toBeNull()
  })
})
