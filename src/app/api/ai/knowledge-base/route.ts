import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { ingestDocument } from '@/lib/ai/knowledge-base'
import { isCloudflareAIConfigured } from '@/lib/ai/cloudflare'

// Cap on a single document body. Ingestion embeds every chunk, so an
// unbounded paste would fan out into a very large number of Workers
// AI calls. 200k chars is roughly a small handbook.
const MAX_CONTENT_CHARS = 200_000

interface KbRow {
  document_id: string
  title: string
  source: string | null
  created_at: string
}

interface KbDocument {
  document_id: string
  title: string
  source: string | null
  chunk_count: number
  created_at: string
}

// GET — list the current user's knowledge-base documents (grouped by
// document_id; one row per upload).
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('ai_knowledge_base')
    .select('document_id, title, source, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byDoc = new Map<string, KbDocument>()
  for (const row of (data ?? []) as KbRow[]) {
    const existing = byDoc.get(row.document_id)
    if (existing) {
      existing.chunk_count += 1
    } else {
      byDoc.set(row.document_id, {
        document_id: row.document_id,
        title: row.title,
        source: row.source,
        chunk_count: 1,
        created_at: row.created_at,
      })
    }
  }

  return NextResponse.json({
    configured: isCloudflareAIConfigured(),
    documents: Array.from(byDoc.values()),
  })
}

// POST — ingest a new document: chunk, embed via Workers AI, store.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isCloudflareAIConfigured()) {
    return NextResponse.json(
      {
        error:
          'Cloudflare Workers AI is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.',
      },
      { status: 503 },
    )
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const content = typeof body.content === 'string' ? body.content : ''
  const source =
    typeof body.source === 'string' && body.source.trim()
      ? body.source.trim()
      : null

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }
  if (!content.trim()) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  if (content.length > MAX_CONTENT_CHARS) {
    return NextResponse.json(
      { error: `content exceeds ${MAX_CONTENT_CHARS} characters` },
      { status: 400 },
    )
  }

  try {
    const result = await ingestDocument({
      userId: user.id,
      title,
      content,
      source,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'ingestion failed'
    const authFailed = /authentication|unauthorized|forbidden|invalid token|api token/i.test(raw)
    const message = authFailed
      ? 'Cloudflare Workers AI rejected the server token. Update CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, then retry.'
      : raw
    return NextResponse.json({ error: message }, { status: authFailed ? 502 : 500 })
  }
}

// DELETE — remove every chunk of a document.
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const documentId = searchParams.get('document_id')
  if (!documentId) {
    return NextResponse.json({ error: 'document_id is required' }, { status: 400 })
  }

  // Scope the delete by user_id as well as document_id — the engine's
  // service-role client bypasses RLS, so the user_id filter is the
  // authorization check that keeps one tenant from deleting another's
  // knowledge base via a guessed document_id.
  const { error } = await supabaseAdmin()
    .from('ai_knowledge_base')
    .delete()
    .eq('document_id', documentId)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ status: 'deleted' })
}
