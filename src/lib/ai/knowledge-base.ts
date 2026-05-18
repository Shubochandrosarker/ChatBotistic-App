// ------------------------------------------------------------
// Knowledge-base ingestion + retrieval for the RAG chatbot.
//
// Ingestion:  text → chunks → Workers AI embeddings → ai_knowledge_base
// Retrieval:  query → embedding → match_kb_chunks() → ranked chunks
//
// All DB access uses the service-role client (the engine and the
// ingestion API both run server-side and need to write embeddings).
// ------------------------------------------------------------

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { embedText, embedTexts } from './cloudflare'

/** Target chunk size in characters, with overlap to preserve context
 *  that straddles a chunk boundary. bge-base handles ~512 tokens; a
 *  ~1000-char chunk stays comfortably under that. */
const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 150

/**
 * Split a document into overlapping chunks. Splits on paragraph
 * boundaries first; any single paragraph longer than CHUNK_SIZE is
 * hard-split so no chunk exceeds the model's context window.
 */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let current = ''

  const flush = () => {
    if (current.trim()) chunks.push(current.trim())
    current = ''
  }

  for (const para of paragraphs) {
    if (para.length > CHUNK_SIZE) {
      flush()
      for (let i = 0; i < para.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        chunks.push(para.slice(i, i + CHUNK_SIZE).trim())
      }
      continue
    }
    if (current.length + para.length + 2 > CHUNK_SIZE) {
      flush()
    }
    current = current ? `${current}\n\n${para}` : para
  }
  flush()

  return chunks
}

export interface IngestResult {
  document_id: string
  chunk_count: number
}

/**
 * Chunk a document, embed every chunk via Workers AI, and store the
 * rows in ai_knowledge_base. All chunks share one document_id so the
 * UI can manage the upload as a single unit.
 */
export async function ingestDocument(args: {
  userId: string
  title: string
  content: string
  source?: string | null
}): Promise<IngestResult> {
  const chunks = chunkText(args.content)
  if (chunks.length === 0) {
    throw new Error('document is empty after chunking')
  }

  const embeddings = await embedTexts(chunks)
  if (embeddings.length !== chunks.length) {
    throw new Error('embedding count does not match chunk count')
  }

  const documentId = randomUUID()
  const rows = chunks.map((content, index) => ({
    user_id: args.userId,
    document_id: documentId,
    title: args.title,
    source: args.source ?? null,
    content,
    chunk_index: index,
    // pgvector accepts the `[1,2,3]` text form; serializing keeps the
    // insert robust regardless of how PostgREST coerces JSON arrays.
    embedding: JSON.stringify(embeddings[index]),
  }))

  const { error } = await supabaseAdmin().from('ai_knowledge_base').insert(rows)
  if (error) throw new Error(`knowledge base insert failed: ${error.message}`)

  return { document_id: documentId, chunk_count: chunks.length }
}

export interface RetrievedChunk {
  id: string
  document_id: string
  title: string
  source: string | null
  content: string
  similarity: number
}

/**
 * Retrieve the chunks most relevant to `query` for a given user.
 * `minSimilarity` drops weak matches so the prompt isn't padded with
 * irrelevant context (and so a query with no real match returns []).
 */
export async function retrieveContext(args: {
  userId: string
  query: string
  topK?: number
  minSimilarity?: number
}): Promise<RetrievedChunk[]> {
  const query = args.query.trim()
  if (!query) return []

  const queryEmbedding = await embedText(query)
  const { data, error } = await supabaseAdmin().rpc('match_kb_chunks', {
    p_user_id: args.userId,
    p_query_embedding: JSON.stringify(queryEmbedding),
    p_match_count: args.topK ?? 5,
  })
  if (error) throw new Error(`knowledge base search failed: ${error.message}`)

  const minSimilarity = args.minSimilarity ?? 0.4
  return ((data ?? []) as RetrievedChunk[]).filter(
    (c) => c.similarity >= minSimilarity,
  )
}
