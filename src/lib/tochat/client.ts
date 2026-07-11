// ------------------------------------------------------------
// Tochat.be (ChatWith) REST API client — full widget/agent/lead
// surface, ported from the WordPress connector's
// `chatbotistic-connector/includes/class-api.php` (the reference
// implementation already running in production).
//
// Auth: one shared master account (email+password) →
//   POST /api/authentication_token → { token }
// The JWT is cached in-memory for ~50 minutes and refreshed once on a
// 401 mid-flight. This module is server-only — the master credentials
// must never reach the browser.
//
// Tenant isolation: every list/create call must pass a `userClient`
// tag scoped to the calling org (see `src/lib/tochat/org.ts`). This
// mirrors the WordPress plugin's `cbc-{wp_user_id}` pattern, but keyed
// on the dashboard's own org id instead: `org-{org_uuid}`.
//
// Env:
//   TOCHAT_API_EMAIL     — required; the master Tochat.be account email
//   TOCHAT_API_PASSWORD  — required; the master Tochat.be account password
//   TOCHAT_API_BASE      — optional; defaults to https://services.tochat.be
// ------------------------------------------------------------

const DEFAULT_BASE = 'https://services.tochat.be'
const TOKEN_TTL_MS = 50 * 60 * 1000 // ~50 minutes, mirrors class-api.php's TOKEN_TTL.

export class TochatApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'TochatApiError'
    this.status = status
  }
}

function baseUrl(): string {
  return (process.env.TOCHAT_API_BASE || DEFAULT_BASE).replace(/\/+$/, '')
}

/** True when the Tochat.be master-account integration is configured. */
export function isTochatConfigured(): boolean {
  return Boolean(process.env.TOCHAT_API_EMAIL && process.env.TOCHAT_API_PASSWORD)
}

function credentials(): { email: string; password: string } {
  const email = process.env.TOCHAT_API_EMAIL
  const password = process.env.TOCHAT_API_PASSWORD
  if (!email || !password) {
    throw new TochatApiError(
      'TOCHAT_API_EMAIL / TOCHAT_API_PASSWORD are not set. Add them to the environment.',
      500,
    )
  }
  return { email, password }
}

// ---- Token cache -----------------------------------------------------
// Module-level, process-lifetime cache. This app deploys as a
// long-running standalone Node server (PM2 / Hostinger — see
// DEPLOY.md), not ephemeral per-request serverless, so an in-memory
// cache behaves like the WordPress plugin's DB-backed transient: one
// login shared across requests for ~50 minutes.

let cachedToken: { token: string; expiresAt: number } | null = null

async function login(): Promise<string> {
  const { email, password } = credentials()
  const res = await rawFetch('/api/authentication_token', 'POST', { email, password }, null)
  const token = (res.body as { token?: string } | null)?.token
  if (!token) {
    throw new TochatApiError('Tochat did not return an authentication token.', 502)
  }
  return token
}

async function getToken(force = false): Promise<string> {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token
  }
  const token = await login()
  cachedToken = { token, expiresAt: Date.now() + TOKEN_TTL_MS }
  return token
}

export function clearTochatToken(): void {
  cachedToken = null
}

// ---- Request plumbing --------------------------------------------------

interface RawResult {
  status: number
  body: unknown
}

async function rawFetch(
  endpoint: string,
  method: string,
  body: Record<string, unknown> | null,
  token: string | null,
): Promise<RawResult> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': method === 'PATCH' ? 'application/merge-patch+json' : 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${baseUrl()}${endpoint}`, {
      method,
      headers,
      body: body != null && ['POST', 'PUT', 'PATCH'].includes(method) ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error'
    throw new TochatApiError(`Could not reach Tochat.be: ${message}`, 502)
  }

  let parsed: unknown = null
  const text = await response.text()
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
  }
  return { status: response.status, body: parsed }
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    const violation =
      Array.isArray(b.violations) && b.violations[0] && typeof b.violations[0] === 'object'
        ? (b.violations[0] as Record<string, unknown>).message
        : undefined
    const message = b.detail ?? b['hydra:description'] ?? b.message ?? violation
    if (typeof message === 'string' && message) return message
  }
  return `Tochat API error (HTTP ${status}).`
}

/**
 * Authenticated request with a one-shot retry on token expiry (mirrors
 * class-api.php's `request()`).
 */
async function request(
  endpoint: string,
  method: string,
  body: Record<string, unknown> | null = null,
): Promise<unknown> {
  let token = await getToken()
  let res = await rawFetch(endpoint, method, body, token)

  if (res.status === 401) {
    clearTochatToken()
    token = await getToken(true)
    res = await rawFetch(endpoint, method, body, token)
  }

  if (res.status < 200 || res.status >= 300) {
    throw new TochatApiError(errorMessage(res.body, res.status), res.status)
  }
  if (method === 'DELETE') return true
  return res.body ?? {}
}

/** Flatten a Hydra collection response to its member array. */
function collection(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[]
  if (result && typeof result === 'object') {
    const members = (result as Record<string, unknown>)['hydra:member']
    if (Array.isArray(members)) return members as Record<string, unknown>[]
  }
  return []
}

/** Extract a resource id from a create/get response (`id` or `@id` IRI). */
export function resourceId(resource: Record<string, unknown>): string {
  if (resource.id != null) return String(resource.id)
  const iri = resource['@id']
  if (typeof iri === 'string') return iri.replace(/\/+$/, '').split('/').pop() ?? ''
  return ''
}

function qs(params: Record<string, string | number | string[]>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) search.append(key, v)
    } else {
      search.set(key, String(value))
    }
  }
  return search.toString()
}

export type TochatResource = Record<string, unknown>

/**
 * The Widget Studio v1 field set — the subset of the full Tochat
 * widget schema (see the Postman collection / services.tochat.be API
 * docs for the complete ~30-field shape, including banners, landing
 * page copy, translations, and targeting rules) that's exposed in
 * this app's UI today. Extra fields on a real widget response are
 * preserved and round-tripped by `TochatResource` — this interface
 * only documents what the dashboard reads and writes.
 */
export interface TochatWidget extends TochatResource {
  id?: string
  '@id'?: string
  name: string
  active?: boolean
  color?: string
  rightpos?: boolean
  isopen?: boolean
  widgetMessage?: string
  buttonMessage?: string
  offlineMessage?: string
  iconUrl?: string
  userClient?: string
}

/**
 * The Agent Manager v1 field set — a WhatsApp operator attached to one
 * widget (`business`, an IRI like `/api/v2/widgets/{id}` on write, an
 * IRI string or embedded object on read depending on the API's
 * serialization group). The full schema also includes a nested
 * `form.items[]` lead-capture form builder, `sequence` (display
 * order), and lead-notification email fields — not in the v1 UI yet.
 */
export interface TochatOperator extends TochatResource {
  id?: string
  '@id'?: string
  number: string
  name: string
  business: string | { id?: string; '@id'?: string }
  post?: string
  message?: string
  iconUrl?: string
  chatform?: boolean
  activateDirectlyChat?: boolean
}

/**
 * Resolve the widget id a `business` relation (IRI string or embedded
 * object, per Hydra's serialization) points at. Returns null when the
 * shape is unrecognized rather than throwing — callers treat that as
 * "can't verify ownership, deny."
 */
export function resourceIdFromIri(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.replace(/\/+$/, '').split('/').pop() || null
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.id === 'string') return obj.id
    if (typeof obj['@id'] === 'string') return resourceIdFromIri(obj['@id'])
  }
  return null
}

// ---- Widgets ------------------------------------------------------------

export const widgets = {
  list: (userClient: string) =>
    request(`/api/v2/widgets?${qs({ 'userClient[]': userClient, itemsPerPage: 100 })}`, 'GET').then(collection),
  get: (id: string) => request(`/api/v2/widgets/${encodeURIComponent(id)}`, 'GET') as Promise<TochatResource>,
  create: (payload: TochatResource) => request('/api/v2/widgets', 'POST', payload) as Promise<TochatResource>,
  update: (id: string, payload: TochatResource) =>
    request(`/api/v2/widgets/${encodeURIComponent(id)}`, 'PUT', payload) as Promise<TochatResource>,
  patch: (id: string, payload: TochatResource) =>
    request(`/api/v2/widgets/${encodeURIComponent(id)}`, 'PATCH', payload) as Promise<TochatResource>,
  remove: (id: string) => request(`/api/v2/widgets/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- WhatsApp operators (agents) -----------------------------------------

export const operators = {
  list: (userClient: string) =>
    request(
      `/api/v2/whatsapp_operators?${qs({ 'business.userClient[]': userClient, itemsPerPage: 200 })}`,
      'GET',
    ).then(collection),
  listForWidget: (widgetId: string) =>
    request(`/api/v2/whatsapp_operators?${qs({ 'business.id': widgetId, itemsPerPage: 200 })}`, 'GET').then(
      collection,
    ),
  get: (id: string) => request(`/api/v2/whatsapp_operators/${encodeURIComponent(id)}`, 'GET') as Promise<TochatResource>,
  create: (payload: TochatResource) =>
    request('/api/v2/whatsapp_operators', 'POST', payload) as Promise<TochatResource>,
  update: (id: string, payload: TochatResource) =>
    request(`/api/v2/whatsapp_operators/${encodeURIComponent(id)}`, 'PUT', payload) as Promise<TochatResource>,
  remove: (id: string) =>
    request(`/api/v2/whatsapp_operators/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- FAQ groups -----------------------------------------------------------

export const faqGroups = {
  list: (operatorId: string) =>
    request(`/api/v2/whatsapp_operators/${encodeURIComponent(operatorId)}/faq_grps`, 'GET').then(collection),
  create: (payload: TochatResource) => request('/api/v2/faq_grps', 'POST', payload) as Promise<TochatResource>,
  update: (id: string, payload: TochatResource) =>
    request(`/api/v2/faq_grps/${encodeURIComponent(id)}`, 'PUT', payload) as Promise<TochatResource>,
  remove: (id: string) => request(`/api/v2/faq_grps/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- Leads (stats) + analytics ---------------------------------------------

export const stats = {
  list: (filters: Record<string, string | number | string[]>) =>
    request(`/api/v2/stats?${qs({ itemsPerPage: 100, ...filters })}`, 'GET').then(collection),
  graph: (widgetId: string, from: string, to: string, type: 'day' | 'week' = 'day') =>
    request(`/api/v2/${encodeURIComponent(widgetId)}/stats-graph?${qs({ from, to, type })}`, 'GET'),
}

export function landingLinks(widgetId: string) {
  return request(`/api/landing-links/${encodeURIComponent(widgetId)}`, 'GET')
}

// ---- Campaigns (broadcast / drip) ------------------------------------------

export const campaigns = {
  list: (userClient: string) =>
    request(
      `/api/v2/campaigns?${qs({ 'business.userClient[]': userClient, itemsPerPage: 100 })}`,
      'GET',
    ).then(collection),
  create: (payload: TochatResource) => request('/api/v2/campaigns', 'POST', payload) as Promise<TochatResource>,
  update: (id: string, payload: TochatResource) =>
    request(`/api/v2/campaigns/${encodeURIComponent(id)}`, 'PUT', payload) as Promise<TochatResource>,
  remove: (id: string) => request(`/api/v2/campaigns/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- Audiences (many_contacts) ---------------------------------------------

export const audiences = {
  list: (userClient: string) =>
    request(
      `/api/v2/many_contacts?${qs({ 'business.userClient[]': userClient, itemsPerPage: 100 })}`,
      'GET',
    ).then(collection),
  create: (payload: TochatResource) => request('/api/v2/many_contacts', 'POST', payload) as Promise<TochatResource>,
  remove: (id: string) => request(`/api/v2/many_contacts/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- Booking configs --------------------------------------------------------

export const bookingConfigs = {
  list: (operatorId: string) =>
    request(`/api/v2/booking_configs?${qs({ whatsapp: operatorId })}`, 'GET').then(collection),
  create: (payload: TochatResource) =>
    request('/api/v2/booking_configs', 'POST', payload) as Promise<TochatResource>,
  update: (id: string, payload: TochatResource) =>
    request(`/api/v2/booking_configs/${encodeURIComponent(id)}`, 'PUT', payload) as Promise<TochatResource>,
  remove: (id: string) => request(`/api/v2/booking_configs/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- Banners -----------------------------------------------------------------

export const banners = {
  list: (widgetId: string) => request(`/api/v2/banners?${qs({ 'business.id': widgetId })}`, 'GET').then(collection),
  create: (payload: TochatResource) => request('/api/v2/banners', 'POST', payload) as Promise<TochatResource>,
  update: (id: string, payload: TochatResource) =>
    request(`/api/v2/banners/${encodeURIComponent(id)}`, 'PUT', payload) as Promise<TochatResource>,
  remove: (id: string) => request(`/api/v2/banners/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- Widget targeting / display rules -----------------------------------------

export const widgetRules = {
  list: (widgetId: string) =>
    request(`/api/v2/widget_rules?${qs({ 'widget.uuid': widgetId })}`, 'GET').then(collection),
  create: (payload: TochatResource) => request('/api/v2/widget_rules', 'POST', payload) as Promise<TochatResource>,
  remove: (id: string) => request(`/api/v2/widget_rules/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- Payment links + transactions -----------------------------------------------

export const paymentLinks = {
  list: (userClient: string) =>
    request(
      `/api/v2/payment_links?${qs({ 'business.userClient[]': userClient, itemsPerPage: 100 })}`,
      'GET',
    ).then(collection),
  create: (payload: TochatResource) => request('/api/v2/payment_links', 'POST', payload) as Promise<TochatResource>,
  remove: (id: string) => request(`/api/v2/payment_links/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

export const transactions = {
  list: (filters: Record<string, string | number | string[]>) =>
    request(`/api/v2/transactions?${qs({ itemsPerPage: 100, ...filters })}`, 'GET').then(collection),
}
