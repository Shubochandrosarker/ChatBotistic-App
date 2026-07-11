import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('tochat client', () => {
  beforeEach(() => {
    process.env.TOCHAT_API_EMAIL = 'master@example.com'
    process.env.TOCHAT_API_PASSWORD = 'secret'
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  it('isTochatConfigured is false when credentials are unset', async () => {
    delete process.env.TOCHAT_API_EMAIL
    delete process.env.TOCHAT_API_PASSWORD
    const { isTochatConfigured } = await import('./client')
    expect(isTochatConfigured()).toBe(false)
  })

  it('logs in once, caches the token, and scopes the widget list by userClient', async () => {
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
    const first = await widgets.list('org-abc')
    const second = await widgets.list('org-abc')

    expect(first).toEqual([{ id: 'w1', name: 'Sales' }])
    expect(second).toEqual([{ id: 'w2', name: 'Support' }])
    // 1 login + 2 list calls — the second list reused the cached token.
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][0]).toContain('/api/authentication_token')
    expect(fetchMock.mock.calls[1][0]).toContain('userClient%5B%5D=org-abc')
  })

  it('clears the cached token and retries once on a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-expired' }))
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'Expired JWT Token' }))
      .mockResolvedValueOnce(jsonResponse(200, { token: 'jwt-fresh' }))
      .mockResolvedValueOnce(jsonResponse(200, { 'hydra:member': [] }))
    vi.stubGlobal('fetch', fetchMock)

    const { widgets } = await import('./client')
    const result = await widgets.list('org-abc')

    expect(result).toEqual([])
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
    await expect(widgets.create({})).rejects.toMatchObject({
      name: 'TochatApiError',
      status: 422,
      message: '`name` is required',
    })
  })
})

describe('tochatUserClientForOrg', () => {
  it('derives a deterministic userClient tag from the org id', async () => {
    const { tochatUserClientForOrg } = await import('./org')
    expect(tochatUserClientForOrg('abc-123')).toBe('org-abc-123')
  })
})
