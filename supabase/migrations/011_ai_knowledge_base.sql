-- ============================================================
-- 011_ai_knowledge_base.sql — RAG knowledge base for the AI chatbot
--
-- Backs the `ai_reply` automation step. A "document" is a single
-- pasted/uploaded body of text; the ingestion layer splits it into
-- chunks and stores one row per chunk, all sharing a `document_id`
-- so the UI can list and delete documents as a unit.
--
-- `embedding` holds the 768-dim vector produced by Cloudflare
-- Workers AI (@cf/baai/bge-base-en-v1.5). Retrieval is cosine
-- similarity via the match_kb_chunks() function below.
--
-- Idempotent — safe to run multiple times. Follows the conventions
-- of 006_automations.sql and 009_org_tenancy.sql (IF NOT EXISTS on
-- tables/indexes, DROP IF EXISTS before re-creating policies/
-- triggers, org-scoped RLS).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- AI_KNOWLEDGE_BASE
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  -- Shared by every chunk of one uploaded document.
  document_id UUID NOT NULL,
  title TEXT NOT NULL,
  source TEXT,
  -- One retrievable chunk of text.
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  -- 768 dims = @cf/baai/bge-base-en-v1.5. Nullable so a row can be
  -- inserted before its embedding lands, though the ingestion path
  -- always fills it in the same call.
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_kb_user ON ai_knowledge_base(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_kb_document ON ai_knowledge_base(document_id);
CREATE INDEX IF NOT EXISTS idx_ai_kb_org ON ai_knowledge_base(org_id);
-- HNSW index for fast cosine-similarity retrieval. The <=> operator
-- (cosine distance) used by match_kb_chunks() is served by this index.
CREATE INDEX IF NOT EXISTS idx_ai_kb_embedding
  ON ai_knowledge_base USING hnsw (embedding vector_cosine_ops);

ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members manage ai_knowledge_base" ON ai_knowledge_base;
CREATE POLICY "Org members manage ai_knowledge_base" ON ai_knowledge_base FOR ALL
  USING (org_id IN (SELECT public.user_org_ids()))
  WITH CHECK (org_id IN (SELECT public.user_org_ids()));

-- Auto-fill org_id from the inserting user's primary org (same
-- BEFORE INSERT trigger every other tenant table uses, from 009).
DROP TRIGGER IF EXISTS set_org_id ON ai_knowledge_base;
CREATE TRIGGER set_org_id BEFORE INSERT ON ai_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();

DROP TRIGGER IF EXISTS set_updated_at ON ai_knowledge_base;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- match_kb_chunks — cosine-similarity retrieval for RAG.
--
-- Called server-side (service-role) by the automation engine and the
-- RAG layer. Scoped by user_id to mirror how the automation engine
-- scopes every other lookup. Returns the closest `p_match_count`
-- chunks ordered by similarity (1 = identical, 0 = orthogonal).
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_kb_chunks(
  p_user_id UUID,
  p_query_embedding vector(768),
  p_match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  title TEXT,
  source TEXT,
  content TEXT,
  similarity REAL
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    kb.id,
    kb.document_id,
    kb.title,
    kb.source,
    kb.content,
    (1 - (kb.embedding <=> p_query_embedding))::REAL AS similarity
  FROM ai_knowledge_base kb
  WHERE kb.user_id = p_user_id
    AND kb.embedding IS NOT NULL
  ORDER BY kb.embedding <=> p_query_embedding
  LIMIT GREATEST(p_match_count, 1);
$$;
