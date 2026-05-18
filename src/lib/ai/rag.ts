// ------------------------------------------------------------
// RAG answer generation.
//
// Ties retrieval (knowledge-base.ts) to generation (cloudflare.ts):
// retrieve the most relevant knowledge-base chunks for a question,
// stuff them into the prompt, and ask Workers AI to answer using
// only that context.
// ------------------------------------------------------------

import { chatCompletion, type ChatMessage } from './cloudflare'
import { retrieveContext, type RetrievedChunk } from './knowledge-base'

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful customer-support assistant replying inside a WhatsApp chat. ' +
  'Answer using ONLY the provided context. If the context does not contain the ' +
  'answer, say you are not sure and offer to connect the customer with a human. ' +
  'Keep replies short, friendly, and suitable for a chat message.'

export interface RagAnswer {
  /** The generated reply, or null when no answer could be produced. */
  answer: string | null
  /** Knowledge-base chunks that were retrieved for this question. */
  sources: RetrievedChunk[]
  /** True when retrieval found no usable context. */
  noContext: boolean
}

/**
 * Generate a retrieval-augmented answer to `question` for a user.
 *
 * When no knowledge-base context is found, returns `noContext: true`
 * and `answer: null` — callers decide whether to send a fallback
 * message or stay silent.
 */
export async function generateRagAnswer(args: {
  userId: string
  question: string
  systemPrompt?: string
  topK?: number
}): Promise<RagAnswer> {
  const question = args.question.trim()
  if (!question) {
    return { answer: null, sources: [], noContext: true }
  }

  const sources = await retrieveContext({
    userId: args.userId,
    query: question,
    topK: args.topK ?? 5,
  })

  if (sources.length === 0) {
    return { answer: null, sources: [], noContext: true }
  }

  const context = sources
    .map((c, i) => `[${i + 1}] ${c.title}\n${c.content}`)
    .join('\n\n---\n\n')

  const messages: ChatMessage[] = [
    { role: 'system', content: args.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Context from the knowledge base:\n\n${context}\n\n---\n\nCustomer question: ${question}`,
    },
  ]

  const answer = await chatCompletion({ messages, maxTokens: 400, temperature: 0.3 })
  return {
    answer: answer || null,
    sources,
    noContext: false,
  }
}
