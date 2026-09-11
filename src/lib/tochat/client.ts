// ------------------------------------------------------------
// Tochat.be (ChatWith) white-label REST API client — full
// widget/agent/lead surface, ported from the WordPress connector's
// `chatbotistic-connector/includes/class-api.php` (the reference
// implementation already running in production).
//
// Auth is scope-based (see `TochatScope`), resolved per org in
// src/lib/tochat/org-config.ts:
//
//   isolated — the org connected its OWN white-label account
//              (email+password stored encrypted per org). The JWT
//              scopes every read/write to that account: each org only
//              ever sees its own widgets, agents, FAQs and bookings.
//
//   shared   — the deployment-wide master account (TOCHAT_API_EMAIL /
//              TOCHAT_API_PASSWORD env). Every list/create call is
//              then scoped by the org's `userClient` tag
//              (org.ts / org-config.ts) so one account can serve many
//              tenants without leaking rows between them.
//
// The JWT is cached in-memory per (base, email) for ~50 minutes and
// refreshed once on a 401 mid-flight. This module is server-only —
// credentials must never reach the browser.
//
// Env (master/shared fallback only):
//   TOCHAT_API_EMAIL     — the shared white-label master account email
//   TOCHAT_API_PASSWORD  — its password
//   TOCHAT_API_BASE      — optional; defaults to https://app.chatbotistic.com
// ------------------------------------------------------------

const DEFAULT_BASE = 'https://app.chatbotistic.com'
const TOKEN_TTL_MS = 50 * 60 * 1000 // ~50 minutes, mirrors class-api.php's TOKEN_TTL.

export class TochatApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'TochatApiError'
    this.status = status
  }
}

export type TochatScopeMode = 'isolated' | 'shared'

/**
 * Everything an API call needs to know about who is calling:
 * which account's credentials to use, which origin to hit, and —
 * for the shared master account — which `userClient` tag owns the
 * caller's rows.
 */
export interface TochatScope {
  orgId: string
  mode: TochatScopeMode
  email: string
  password: string
  /** API origin, no trailing slash. */
  base: string
  /**
   * The org's tag inside the shared white-label account. Null in
   * `isolated` mode — the account's own JWT already scopes the data.
   */
  userClient: string | null
}

export function normalizeTochatBase(raw: string | null | undefined): string {
  return (raw || DEFAULT_BASE).replace(/\/+$/, '')
}

/**
 * The public white-label API origin — safe to send to the browser (it's
 * an API host, not a secret) so the UI can build embed script URLs
 * (`{base}/widget/{id}/load.js`) without duplicating the base-override
 * logic client-side. Per-org overrides win over the env default.
 */
export function tochatPublicBase(scope: TochatScope | null): string {
  return scope?.base ?? normalizeTochatBase(process.env.TOCHAT_API_BASE)
}

// ---- Token cache -----------------------------------------------------
// Module-level, process-lifetime cache keyed by (base, email) so the
// isolated accounts and the shared master never share tokens. This app
// deploys as a long-running standalone Node server (PM2 / Hostinger —
// see DEPLOY.md), not ephemeral per-request serverless, so an in-memory
// cache behaves like the WordPress plugin's DB-backed transient.

const tokenCache = new Map<string, { token: string; expiresAt: number }>()

function cacheKey(scope: TochatScope): string {
  return `${scope.base}|${scope.email}`
}

async function login(scope: TochatScope): Promise<string> {
  const res = await rawFetch(
    scope.base,
    '/api/authentication_token',
    'POST',
    { email: scope.email, password: scope.password },
    null,
  )
  const token = (res.body as { token?: string } | null)?.token
  if (!token) {
    throw new TochatApiError('The white-label API did not return an authentication token.', 502)
  }
  return token
}

async function getToken(scope: TochatScope, force = false): Promise<string> {
  const key = cacheKey(scope)
  const cached = tokenCache.get(key)
  if (!force && cached && cached.expiresAt > Date.now()) {
    return cached.token
  }
  const token = await login(scope)
  tokenCache.set(key, { token, expiresAt: Date.now() + TOKEN_TTL_MS })
  return token
}

export function clearTochatToken(scope: TochatScope | null = null): void {
  if (scope) {
    tokenCache.delete(cacheKey(scope))
  } else {
    tokenCache.clear()
  }
}

/**
 * One-shot credential check used by the connect flow in
 * /api/tochat/config — verifies the email+password actually
 * authenticate against the white-label API before anything is stored.
 * Throws TochatApiError (status 401) on bad credentials.
 */
export async function verifyTochatLogin(
  email: string,
  password: string,
  baseOverride?: string | null,
): Promise<void> {
  const base = normalizeTochatBase(baseOverride || process.env.TOCHAT_API_BASE)
  const res = await rawFetch(base, '/api/authentication_token', 'POST', { email, password }, null)
  if (res.status === 401) {
    throw new TochatApiError('Invalid email or password for the white-label account.', 401)
  }
  if (res.status < 200 || res.status >= 300) {
    throw new TochatApiError(
      `Could not verify the account (HTTP ${res.status}).`,
      res.status >= 500 ? 502 : res.status,
    )
  }
  const token = (res.body as { token?: string } | null)?.token
  if (!token) {
    throw new TochatApiError('The white-label API accepted the login but returned no token.', 502)
  }
}

// ---- Request plumbing --------------------------------------------------

interface RawResult {
  status: number
  body: unknown
}

async function rawFetch(
  base: string,
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
    response = await fetch(`${base}${endpoint}`, {
      method,
      headers,
      body: body != null && ['POST', 'PUT', 'PATCH'].includes(method) ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error'
    throw new TochatApiError(`Could not reach the white-label API: ${message}`, 502)
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
  scope: TochatScope,
  endpoint: string,
  method: string,
  body: Record<string, unknown> | null = null,
): Promise<unknown> {
  let token = await getToken(scope)
  let res = await rawFetch(scope.base, endpoint, method, body, token)

  if (res.status === 401) {
    clearTochatToken(scope)
    token = await getToken(scope, true)
    res = await rawFetch(scope.base, endpoint, method, body, token)
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

/**
 * The tag filter for list calls in `shared` mode. Empty in `isolated`
 * mode — the org's own JWT already scopes the collection, and applying
 * a tag there would hide legitimately untagged rows of their account.
 */
function tagParam(scope: TochatScope): Record<string, string[]> {
  return scope.userClient ? { 'userClient[]': [scope.userClient] } : {}
}

function businessTagParam(scope: TochatScope): Record<string, string[]> {
  return scope.userClient ? { 'business.userClient[]': [scope.userClient] } : {}
}

export type TochatResource = Record<string, unknown>

/**
 * The full widget field set exposed by Widget Studio, sourced from the
 * "Create widget" / "Edit" examples in the ChatWith Postman collection
 * (the only ground truth available — services.tochat.be's own docs
 * endpoint is unreachable from this environment). Fields not in this
 * list still round-trip untouched through `TochatResource`.
 */
export interface TochatWidget extends TochatResource {
  id?: string
  '@id'?: string
  name: string
  active?: boolean
  userClient?: string

  // Appearance
  color?: string
  rightpos?: boolean
  isopen?: boolean
  theme?: number
  zIndex?: number
  iconUrl?: string
  whatsappIconUrl?: string
  backgroundImageUrl?: string

  // Messages
  widgetMessage?: string
  buttonMessage?: string
  offlineMessage?: string
  legend?: string
  WelcomeBackMessage?: string
  transYourPhone?: string
  telValidationText?: string
  requiredValidationText?: string
  emailValidationText?: string
  transSuccessMessage?: string
  translateChatAnswer?: string
  translateOnlineFrom?: string
  translateShowTimetable?: string
  showAllAgents?: string
  showLessAgents?: string

  // Banner
  bannerUrl?: string
  ActivateBanner?: boolean
  returningBannerUrl?: string
  showBannerLanding?: boolean

  // Landing page
  slug?: string
  landingPrimaryColor?: string
  landingSecondaryColor?: string
  landingLegal?: string
  landingTermsAndConditions?: string
  landingPrivacy?: string

  // Legal / cookies
  enableCookieBanner?: boolean
  cookiesTitle?: string
  cookiesDescription?: string

  // Advanced
  haltBusiness?: boolean
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

/** A single FAQ entry within a group. */
export interface TochatFaq {
  question: string
  answer: string
}

/**
 * A FAQ group belongs to one agent (`whatsapp`, same IRI-or-object
 * relation shape as `TochatOperator.business`).
 */
export interface TochatFaqGroup extends TochatResource {
  id?: string
  '@id'?: string
  title: string
  whatsapp: string | { id?: string; '@id'?: string }
  faqs: TochatFaq[]
}

export type TochatWeekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'

/** One recurring availability window within a booking config. */
export interface TochatBookingTime {
  day: TochatWeekday
  availableFrom: string
  availableUntil: string
}

/**
 * The appointment-scheduling rules for one agent — booking window,
 * slot duration, weekly availability, and reminder settings. Belongs
 * to exactly one agent, same relation shape as a FAQ group.
 */
export interface TochatBookingConfig extends TochatResource {
  id?: string
  '@id'?: string
  whatsapp: string | { id?: string; '@id'?: string }
  startDate: string
  endDate: string
  duration: number
  breakTime?: number
  availablePlacePerSlot?: number
  allowedHourUntilBooking?: number
  bookingTimes: TochatBookingTime[]
  timezone: string
  sendReminder?: boolean
  sendReminder48?: boolean
  cancelBookingInReminder?: boolean
  blockingDays?: string[]
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
  list: (scope: TochatScope) =>
    request(scope, `/api/v2/widgets?${qs({ ...tagParam(scope), itemsPerPage: 100 })}`, 'GET').then(
      collection,
    ),
  get: (scope: TochatScope, id: string) =>
    request(scope, `/api/v2/widgets/${encodeURIComponent(id)}`, 'GET') as Promise<TochatResource>,
  create: (scope: TochatScope, payload: TochatResource) =>
    request(scope, '/api/v2/widgets', 'POST', {
      ...payload,
      // Tag only in shared mode — in isolated mode the widget already
      // lands in the org's own account, and a stray tag would break
      // their white-label dashboard's grouping.
      ...(scope.userClient ? { userClient: scope.userClient } : {}),
    }) as Promise<TochatResource>,
  update: (scope: TochatScope, id: string, payload: TochatResource) =>
    request(scope, `/api/v2/widgets/${encodeURIComponent(id)}`, 'PUT', payload) as Promise<TochatResource>,
  patch: (scope: TochatScope, id: string, payload: TochatResource) =>
    request(scope, `/api/v2/widgets/${encodeURIComponent(id)}`, 'PATCH', payload) as Promise<TochatResource>,
  remove: (scope: TochatScope, id: string) =>
    request(scope, `/api/v2/widgets/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- WhatsApp operators (agents) -----------------------------------------

export const operators = {
  list: (scope: TochatScope) =>
    request(
      scope,
      `/api/v2/whatsapp_operators?${qs({ ...businessTagParam(scope), itemsPerPage: 200 })}`,
      'GET',
    ).then(collection),
  listForWidget: (scope: TochatScope, widgetId: string) =>
    request(
      scope,
      `/api/v2/whatsapp_operators?${qs({ 'business.id': widgetId, itemsPerPage: 200 })}`,
      'GET',
    ).then(collection),
  get: (scope: TochatScope, id: string) =>
    request(scope, `/api/v2/whatsapp_operators/${encodeURIComponent(id)}`, 'GET') as Promise<TochatResource>,
  create: (scope: TochatScope, payload: TochatResource) =>
    request(scope, '/api/v2/whatsapp_operators', 'POST', payload) as Promise<TochatResource>,
  update: (scope: TochatScope, id: string, payload: TochatResource) =>
    request(scope, `/api/v2/whatsapp_operators/${encodeURIComponent(id)}`, 'PUT', payload) as Promise<TochatResource>,
  remove: (scope: TochatScope, id: string) =>
    request(scope, `/api/v2/whatsapp_operators/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- FAQ groups -----------------------------------------------------------

export const faqGroups = {
  list: (scope: TochatScope, operatorId: string) =>
    request(
      scope,
      `/api/v2/whatsapp_operators/${encodeURIComponent(operatorId)}/faq_grps`,
      'GET',
    ).then(collection),
  get: (scope: TochatScope, id: string) =>
    request(scope, `/api/v2/faq_grps/${encodeURIComponent(id)}`, 'GET') as Promise<TochatResource>,
  create: (scope: TochatScope, payload: TochatResource) =>
    request(scope, '/api/v2/faq_grps', 'POST', payload) as Promise<TochatResource>,
  update: (scope: TochatScope, id: string, payload: TochatResource) =>
    request(scope, `/api/v2/faq_grps/${encodeURIComponent(id)}`, 'PUT', payload) as Promise<TochatResource>,
  remove: (scope: TochatScope, id: string) =>
    request(scope, `/api/v2/faq_grps/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- Leads (stats) + analytics ---------------------------------------------

export const stats = {
  /**
   * Lead/stat rows. In shared mode the caller MUST pass the org's
   * userClient filter (or scope by a widget it owns) — never call
   * this unfiltered with the master account.
   */
  list: (scope: TochatScope, filters: Record<string, string | number | string[]>) =>
    request(scope, `/api/v2/stats?${qs({ itemsPerPage: 100, ...filters })}`, 'GET').then(collection),
  graph: (scope: TochatScope, widgetId: string, from: string, to: string, type: 'day' | 'week' = 'day') =>
    request(scope, `/api/v2/${encodeURIComponent(widgetId)}/stats-graph?${qs({ from, to, type })}`, 'GET'),
}

export function landingLinks(scope: TochatScope, widgetId: string) {
  return request(scope, `/api/landing-links/${encodeURIComponent(widgetId)}`, 'GET')
}

// ---- Campaigns (broadcast / drip) ------------------------------------------

export const campaigns = {
  list: (scope: TochatScope) =>
    request(
      scope,
      `/api/v2/campaigns?${qs({ ...businessTagParam(scope), itemsPerPage: 100 })}`,
      'GET',
    ).then(collection),
  create: (scope: TochatScope, payload: TochatResource) =>
    request(scope, '/api/v2/campaigns', 'POST', payload) as Promise<TochatResource>,
  update: (scope: TochatScope, id: string, payload: TochatResource) =>
    request(scope, `/api/v2/campaigns/${encodeURIComponent(id)}`, 'PUT', payload) as Promise<TochatResource>,
  remove: (scope: TochatScope, id: string) =>
    request(scope, `/api/v2/campaigns/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- Audiences (many_contacts) ---------------------------------------------

export const audiences = {
  list: (scope: TochatScope) =>
    request(
      scope,
      `/api/v2/many_contacts?${qs({ ...businessTagParam(scope), itemsPerPage: 100 })}`,
      'GET',
    ).then(collection),
  create: (scope: TochatScope, payload: TochatResource) =>
    request(scope, '/api/v2/many_contacts', 'POST', payload) as Promise<TochatResource>,
  remove: (scope: TochatScope, id: string) =>
    request(scope, `/api/v2/many_contacts/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- Booking configs --------------------------------------------------------

export const bookingConfigs = {
  list: (scope: TochatScope, operatorId: string) =>
    request(
      scope,
      `/api/v2/whatsapp_operators/${encodeURIComponent(operatorId)}/booking_configs`,
      'GET',
    ).then(collection),
  get: (scope: TochatScope, id: string) =>
    request(scope, `/api/v2/booking_configs/${encodeURIComponent(id)}`, 'GET') as Promise<TochatResource>,
  create: (scope: TochatScope, payload: TochatResource) =>
    request(scope, '/api/v2/booking_configs', 'POST', payload) as Promise<TochatResource>,
  update: (scope: TochatScope, id: string, payload: TochatResource) =>
    request(scope, `/api/v2/booking_configs/${encodeURIComponent(id)}`, 'PUT', payload) as Promise<TochatResource>,
  remove: (scope: TochatScope, id: string) =>
    request(scope, `/api/v2/booking_configs/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- Banners -----------------------------------------------------------------

export const banners = {
  list: (scope: TochatScope, widgetId: string) =>
    request(scope, `/api/v2/banners?${qs({ 'business.id': widgetId })}`, 'GET').then(collection),
  create: (scope: TochatScope, payload: TochatResource) =>
    request(scope, '/api/v2/banners', 'POST', payload) as Promise<TochatResource>,
  update: (scope: TochatScope, id: string, payload: TochatResource) =>
    request(scope, `/api/v2/banners/${encodeURIComponent(id)}`, 'PUT', payload) as Promise<TochatResource>,
  remove: (scope: TochatScope, id: string) =>
    request(scope, `/api/v2/banners/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- Widget targeting / display rules -----------------------------------------

export const widgetRules = {
  list: (scope: TochatScope, widgetId: string) =>
    request(scope, `/api/v2/widget_rules?${qs({ 'widget.uuid': widgetId })}`, 'GET').then(collection),
  create: (scope: TochatScope, payload: TochatResource) =>
    request(scope, '/api/v2/widget_rules', 'POST', payload) as Promise<TochatResource>,
  remove: (scope: TochatScope, id: string) =>
    request(scope, `/api/v2/widget_rules/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

// ---- Payment links + transactions -----------------------------------------------

export const paymentLinks = {
  list: (scope: TochatScope) =>
    request(
      scope,
      `/api/v2/payment_links?${qs({ ...businessTagParam(scope), itemsPerPage: 100 })}`,
      'GET',
    ).then(collection),
  create: (scope: TochatScope, payload: TochatResource) =>
    request(scope, '/api/v2/payment_links', 'POST', payload) as Promise<TochatResource>,
  remove: (scope: TochatScope, id: string) =>
    request(scope, `/api/v2/payment_links/${encodeURIComponent(id)}`, 'DELETE') as Promise<boolean>,
}

export const transactions = {
  list: (scope: TochatScope, filters: Record<string, string | number | string[]>) =>
    request(scope, `/api/v2/transactions?${qs({ itemsPerPage: 100, ...filters })}`, 'GET').then(collection),
}
