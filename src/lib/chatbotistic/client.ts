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

const DEFAULT_BASE = 'https://app.chatbotistic.com'

/** A single lead, normalised from whatever field names the API returns. */
export interface ChatbotisticLead {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  message: string | null
  source: string | null
  createdAt: string | null
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
function pick(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    for (const actual of Object.keys(record)) {
      if (actual.toLowerCase() === key.toLowerCase()) {
        const value = record[actual]
        if (value != null && value !== '') return String(value)
      }
    }
  }
  return null
}

function normaliseLead(
  record: Record<string, unknown>,
  index: number,
): ChatbotisticLead {
  return {
    id:
      pick(record, ['id', '_id', 'leadId', 'lead_id', 'uuid']) ??
      `lead-${index}`,
    name: pick(record, ['name', 'fullName', 'full_name', 'firstName', 'contactName']),
    email: pick(record, ['email', 'emailAddress', 'email_address']),
    phone: pick(record, ['phone', 'phoneNumber', 'phone_number', 'mobile', 'whatsapp']),
    message: pick(record, ['message', 'text', 'note', 'notes', 'enquiry', 'comment']),
    source: pick(record, ['source', 'channel', 'chatbot', 'botName', 'origin']),
    createdAt: pick(record, ['createdAt', 'created_at', 'date', 'timestamp', 'time']),
    raw: record,
  }
}

// The API's envelope is not contractually fixed here, so accept the
// common shapes: a bare array, or an object wrapping the array under
// one of several conventional keys.
function extractArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[]
  if (payload && typeof payload === 'object') {
    for (const key of ['data', 'leads', 'results', 'items', 'records']) {
      const value = (payload as Record<string, unknown>)[key]
      if (Array.isArray(value)) return value as Record<string, unknown>[]
    }
  }
  return []
}

const PAGE_SIZE_HINT = 20

/**
 * Fetch one page of leads captured on or after `fromDate` (YYYY-MM-DD).
 * Throws ChatbotisticError on a non-2xx response or misconfiguration.
 */
export async function fetchLeads(params: {
  fromDate: string
  page?: number
}): Promise<LeadsResult> {
  const page = Math.max(1, params.page ?? 1)
  const url = new URL(`${baseUrl()}/api/get-json-lead`)
  url.searchParams.set('fromDate', params.fromDate)
  url.searchParams.set('page', String(page))

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: apiKey(),
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
