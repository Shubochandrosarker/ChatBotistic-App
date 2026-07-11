import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TochatApiError } from './client'

const mocks = vi.hoisted(() => ({
  widgetsGet: vi.fn(),
  operatorsGet: vi.fn(),
  faqGroupsGet: vi.fn(),
  bookingConfigsGet: vi.fn(),
}))

vi.mock('./client', async () => {
  const actual = await vi.importActual<typeof import('./client')>('./client')
  return {
    ...actual,
    widgets: { get: mocks.widgetsGet },
    operators: { get: mocks.operatorsGet },
    faqGroups: { get: mocks.faqGroupsGet },
    bookingConfigs: { get: mocks.bookingConfigsGet },
  }
})

const notFound = () => Promise.reject(new TochatApiError('Not Found', 404))
const serverError = () => Promise.reject(new TochatApiError('boom', 500))

describe('widgetOwnedByOrg', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the widget when its userClient matches the caller org', async () => {
    mocks.widgetsGet.mockResolvedValue({ id: 'w1', userClient: 'org-abc' })
    const { widgetOwnedByOrg } = await import('./ownership')
    await expect(widgetOwnedByOrg('w1', 'abc')).resolves.toEqual({ id: 'w1', userClient: 'org-abc' })
  })

  it('returns null when the widget belongs to a different org', async () => {
    mocks.widgetsGet.mockResolvedValue({ id: 'w1', userClient: 'org-someone-else' })
    const { widgetOwnedByOrg } = await import('./ownership')
    await expect(widgetOwnedByOrg('w1', 'abc')).resolves.toBeNull()
  })

  it('returns null (not throw) when Tochat genuinely 404s', async () => {
    mocks.widgetsGet.mockImplementation(notFound)
    const { widgetOwnedByOrg } = await import('./ownership')
    await expect(widgetOwnedByOrg('missing', 'abc')).resolves.toBeNull()
  })

  it('re-throws non-404 errors instead of swallowing them', async () => {
    mocks.widgetsGet.mockImplementation(serverError)
    const { widgetOwnedByOrg } = await import('./ownership')
    await expect(widgetOwnedByOrg('w1', 'abc')).rejects.toMatchObject({ status: 500 })
  })
})

describe('operatorOwnedByOrg', () => {
  beforeEach(() => vi.clearAllMocks())

  it('walks up to the parent widget and confirms ownership', async () => {
    mocks.operatorsGet.mockResolvedValue({ id: 'op1', business: '/api/v2/widgets/w1' })
    mocks.widgetsGet.mockResolvedValue({ id: 'w1', userClient: 'org-abc' })
    const { operatorOwnedByOrg } = await import('./ownership')
    const result = await operatorOwnedByOrg('op1', 'abc')
    expect(result).toMatchObject({ id: 'op1' })
  })

  it('denies when the parent widget belongs to another org', async () => {
    mocks.operatorsGet.mockResolvedValue({ id: 'op1', business: '/api/v2/widgets/w1' })
    mocks.widgetsGet.mockResolvedValue({ id: 'w1', userClient: 'org-someone-else' })
    const { operatorOwnedByOrg } = await import('./ownership')
    await expect(operatorOwnedByOrg('op1', 'abc')).resolves.toBeNull()
  })

  it('denies when the business relation has an unrecognized shape', async () => {
    mocks.operatorsGet.mockResolvedValue({ id: 'op1', business: 42 })
    const { operatorOwnedByOrg } = await import('./ownership')
    await expect(operatorOwnedByOrg('op1', 'abc')).resolves.toBeNull()
  })
})

describe('faqGroupOwnedByOrg / bookingConfigOwnedByOrg', () => {
  beforeEach(() => vi.clearAllMocks())

  it('faqGroupOwnedByOrg walks agent -> widget before confirming ownership', async () => {
    mocks.faqGroupsGet.mockResolvedValue({ id: 'faq1', whatsapp: '/api/v2/whatsapp_operators/op1' })
    mocks.operatorsGet.mockResolvedValue({ id: 'op1', business: '/api/v2/widgets/w1' })
    mocks.widgetsGet.mockResolvedValue({ id: 'w1', userClient: 'org-abc' })
    const { faqGroupOwnedByOrg } = await import('./ownership')
    await expect(faqGroupOwnedByOrg('faq1', 'abc')).resolves.toMatchObject({ id: 'faq1' })
  })

  it('bookingConfigOwnedByOrg denies when the chain resolves to a different org', async () => {
    mocks.bookingConfigsGet.mockResolvedValue({ id: 'bc1', whatsapp: '/api/v2/whatsapp_operators/op1' })
    mocks.operatorsGet.mockResolvedValue({ id: 'op1', business: '/api/v2/widgets/w1' })
    mocks.widgetsGet.mockResolvedValue({ id: 'w1', userClient: 'org-someone-else' })
    const { bookingConfigOwnedByOrg } = await import('./ownership')
    await expect(bookingConfigOwnedByOrg('bc1', 'abc')).resolves.toBeNull()
  })
})
