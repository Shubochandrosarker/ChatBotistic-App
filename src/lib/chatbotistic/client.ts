// ------------------------------------------------------------
// Chatbotistic (tochat.be) leads client.
//
// Pulls captured chatbot leads from the Chatbotistic API and
// normalises them into a stable shape the CRM can render. Runs
// server-side only — the API key must never reach the browser.
//
//   GET {BASE}/api/get-json-lead?fromDate=YYYY-MM-DD&page=N
//   Authorization: <api key>   (sent as a raw header value)
//
// Env:
//   CHATBOTISTIC_API_KEY  — required; the account API key
//   CHATBOTISTIC_API_URL  — optional; defaults to the hosted API
// ------------------------------------------------------------

const DEFAULT_BASE = 'https://services.tochat.be'

/** A single lead, normalised from whatever field names the API returns. */
export interface ChatbotisticLead {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  message: string | null
  source: string | null
  country: string | null
  agent: string | null
  widget: string | null
  landingUrl: string | null
  utm: string | null
  ip: string | null
  createdAt: string | null
  /** Every captured form field, as label/value pairs. */
  fields: { label: string; value: string }[]
  /** The untouched original record, for fields we don't map explicitly. */
  raw: Record<string, unknown>
}

export interface LeadsResult {
  leads: ChatbotisticLead[]
  page: number
  /** True when the API returned a full page — a next page may exist. */
  hasMore: boolean
}

export class ChatbotisticError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ChatbotisticError'
    this.status = status
  }
}

function baseUrl(): string {
  return (process.env.CHATBOTISTIC_API_URL || DEFAULT_BASE).replace(/\/+$/, '')
}

function apiKey(): string {
  const key = process.env.CHATBOTISTIC_API_KEY
  if (!key) {
    throw new ChatbotisticError(
      'CHATBOTISTIC_API_KEY is not set. Add it to the environment.',
      500,
    )
  }
  return key
}

/** True when the Chatbotistic integration is configured. */
export function isChatbotisticConfigured(): boolean {
  return Boolean(process.env.CHATBOTISTIC_API_KEY)
}

// Case-insensitive lookup across a list of candidate keys.
function stringifyUnknown(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of ['name', 'title', 'label', 'email', 'phone']) {
      if (obj[key] != null && obj[key] !== '') return String(obj[key])
    }
  }
  return null
}

function pick(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    for (const actual of Object.keys(record)) {
      if (actual.toLowerCase() === key.toLowerCase()) {
        const mapped = stringifyUnknown(record[actual])
        if (mapped) return mapped
      }
    }
  }
  return null
}

// The tochat.be / Chatbotistic platform stores captured form fields as
// an array of label/value pairs (the `data` / `dataProperties` field of
// a Stats record) rather than as named columns. Flatten it so we can
// match fields by label regardless of how the form was configured.
function extractFields(
  record: Record<string, unknown>,
): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  for (const key of ['data', 'dataProperties', 'fields', 'formData']) {
    const arr = record[key]
    if (!Array.isArray(arr)) continue
    for (const entry of arr) {
      if (!entry || typeof entry !== 'object') continue
      const e = entry as Record<string, unknown>
      const label = e.label ?? e.name ?? e.key ?? e.title
      const value = e.val ?? e.value ?? e.text ?? e.answer
      if (label != null && value != null && String(value) !== '') {
        out.push({ label: String(label), value: String(value) })
      }
    }
  }
  return out
}

// Match a captured field by a set of label keywords (English + Spanish,
// since tochat.be forms are frequently localised).
function fieldByLabel(
  fields: { label: string; value: string }[],
  keywords: string[],
): string | null {
  for (const kw of keywords) {
    const hit = fields.find((f) => f.label.toLowerCase().includes(kw))
    if (hit) return hit.value
  }
  return null
}

function normaliseLead(
  record: Record<string, unknown>,
  index: number,
): ChatbotisticLead {
  const fields = extractFields(record)

  return {
    id:
      pick(record, ['id', '_id', 'leadId', 'lead_id', 'uuid']) ??
      `lead-${index}`,
    name:
      pick(record, ['name', 'fullName', 'full_name', 'firstName', 'contactName', 'nombre']) ??
      fieldByLabel(fields, ['name', 'nombre', 'nom']),
    email:
      pick(record, ['email', 'emailAddress', 'email_address', 'mail']) ??
      fieldByLabel(fields, ['email', 'correo', 'mail']),
    phone:
      pick(record, ['phone', 'phoneNumber', 'phone_number', 'mobile', 'whatsapp', 'whatsappNumber', 'tel', 'telephone']) ??
      fieldByLabel(fields, ['phone', 'tel', 'teléfono', 'telefono', 'whatsapp', 'móvil', 'movil', 'number']),
    message:
      pick(record, ['message', 'text', 'note', 'notes', 'enquiry', 'comment', 'lastMessage']) ??
      fieldByLabel(fields, ['message', 'mensaje', 'comment', 'comentario', 'enquiry', 'last messages']),
    source:
      pick(record, ['source', 'channel', 'chatbot', 'botName', 'origin', 'referer', 'utm_source', 'utmSource']) ??
      fieldByLabel(fields, ['utm_medium', 'utm', 'source', 'channel', 'url_lead']),
    country:
      pick(record, ['country', 'pais', 'país', 'countryCode']) ??
      fieldByLabel(fields, ['country', 'pais', 'país']),
    agent:
      pick(record, ['agent', 'agentName', 'operator', 'operatorName', 'whatsappOperator']) ??
      fieldByLabel(fields, ['agent', 'operator', 'whatsapp agent']),
    widget:
      pick(record, ['widget', 'widgetName', 'business', 'businessName']) ??
      fieldByLabel(fields, ['widget', 'business']),
    landingUrl:
      pick(record, ['url', 'urlLead', 'url_lead', 'landing', 'referer', 'URL_LEAD']) ??
      fieldByLabel(fields, ['url_lead', 'url lead', 'landing', 'url_first']),
    utm:
      pick(record, ['utm', 'utmMedium', 'utm_medium', 'utmSource', 'utm_source']) ??
      fieldByLabel(fields, ['utm', 'utm_medium', 'utm_source']),
    ip:
      pick(record, ['ip', 'ipAddress', 'ip_address']) ??
      fieldByLabel(fields, ['ip']),
    createdAt: pick(record, [
      'createdAt',
      'created_at',
      'created',
      'date',
      'timestamp',
      'time',
      'captured',
    ]),
    fields,
    raw: record,
  }
}

// The API's envelope is not contractually fixed here, so accept the
// common shapes: a bare array, or an object wrapping the array under
// one of several conventional keys.
function extractArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[]
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    for (const key of ['data', 'leads', 'results', 'items', 'records', 'Stats', 'stats', 'hydra:member', 'member']) {
      const value = obj[key]
      if (Array.isArray(value)) return value as Record<string, unknown>[]
    }
    if (obj.Stats && typeof obj.Stats === 'object') {
      const stats = obj.Stats as Record<string, unknown>
      if (Array.isArray(stats.data)) return stats.data as Record<string, unknown>[]
    }
  }
  return []
}

const PAGE_SIZE_HINT = 20

/**
 * Fetch one page of leads captured on or after `fromDate` (YYYY-MM-DD).
 * `apiKey`/`baseUrl` let callers use an org's own key (per-tenant
 * leads isolation — src/lib/tochat/org-config.ts); when omitted the
 * deployment-wide CHATBOTISTIC_API_KEY is used.
 * Throws ChatbotisticError on a non-2xx response or misconfiguration.
 */
export async function fetchLeads(params: {
  fromDate: string
  page?: number
  apiKey?: string
  baseUrl?: string | null
}): Promise<LeadsResult> {
  const page = Math.max(1, params.page ?? 1)
  const origin = (params.baseUrl || baseUrl()).replace(/\/+$/, '')
  const key = params.apiKey || apiKey()
  const url = new URL(`${origin}/api/get-json-lead`)
  url.searchParams.set('fromDate', params.fromDate)
  url.searchParams.set('page', String(page))

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: key,
        Accept: 'application/json',
      },
      // Leads change over time — never serve a stale cached page.
      cache: 'no-store',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error'
    throw new ChatbotisticError(`Could not reach Chatbotistic: ${message}`, 502)
  }

  if (!response.ok) {
    throw new ChatbotisticError(
      `Chatbotistic API returned ${response.status} ${response.statusText}.`,
      response.status === 401 || response.status === 403 ? 401 : 502,
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ChatbotisticError('Chatbotistic API returned invalid JSON.', 502)
  }

  const rows = extractArray(payload)
  return {
    leads: rows.map(normaliseLead),
    page,
    hasMore: rows.length >= PAGE_SIZE_HINT,
  }
}
