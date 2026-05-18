// ------------------------------------------------------------
// Cloudflare Workers AI client.
//
// Workers AI runs both the embedding model and the chat model on
// Cloudflare's edge. We call the REST API directly (no SDK) so the
// app stays deployable as a plain Next.js standalone build:
//
//   POST https://api.cloudflare.com/client/v4/accounts/{id}/ai/run/{model}
//
// Auth is a single API token with the "Workers AI" permission.
//
// Env:
//   CLOUDFLARE_ACCOUNT_ID  — account that owns the Workers AI binding
//   CLOUDFLARE_API_TOKEN   — token with Workers AI read access
//   CLOUDFLARE_AI_EMBEDDING_MODEL  (optional) — defaults to bge-base
//   CLOUDFLARE_AI_CHAT_MODEL       (optional) — defaults to llama-3.1-8b
// ------------------------------------------------------------

/** 768-dim embedding model. Must match vector(768) in migration 011. */
const DEFAULT_EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'
const DEFAULT_CHAT_MODEL = '@cf/meta/llama-3.1-8b-instruct'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function accountId(): string {
  const id = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!id) throw new Error('CLOUDFLARE_ACCOUNT_ID is not set')
  return id
}

function apiToken(): string {
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set')
  return token
}

/** True when both required env vars are present. */
export function isCloudflareAIConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN)
}

export function embeddingModel(): string {
  return process.env.CLOUDFLARE_AI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL
}

export function chatModel(): string {
  return process.env.CLOUDFLARE_AI_CHAT_MODEL || DEFAULT_CHAT_MODEL
}

interface CloudflareAIResponse<T> {
  result: T
  success: boolean
  errors?: Array<{ code: number; message: string }>
}

async function runModel<T>(model: string, body: unknown): Promise<T> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId()}/ai/run/${model}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = (await res.json().catch(() => null)) as CloudflareAIResponse<T> | null
  if (!res.ok || !json || !json.success) {
    const detail =
      json?.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`
    throw new Error(`Cloudflare Workers AI (${model}) failed: ${detail}`)
  }
  return json.result
}

/**
 * Embed one or more strings. Returns one vector per input, in order.
 * Workers AI caps a single request at 100 inputs, so larger batches
 * are split transparently.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const BATCH = 100
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH)
    const result = await runModel<{ data: number[][] }>(embeddingModel(), {
      text: slice,
    })
    out.push(...result.data)
  }
  return out
}

/** Embed a single string. */
export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text])
  if (!vec) throw new Error('Cloudflare Workers AI returned no embedding')
  return vec
}

/**
 * Run a chat completion. Returns the assistant's reply text.
 */
export async function chatCompletion(args: {
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
}): Promise<string> {
  const result = await runModel<{ response: string }>(chatModel(), {
    messages: args.messages,
    max_tokens: args.maxTokens ?? 512,
    temperature: args.temperature ?? 0.3,
  })
  return (result.response ?? '').trim()
}
