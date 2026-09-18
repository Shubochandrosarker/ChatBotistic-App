
-- ============================================================
-- 001_initial_schema.sql
-- ============================================================
-- ============================================================
-- Idempotent migration — safe to run multiple times.
-- Uses IF NOT EXISTS for tables/indexes and DROP IF EXISTS
-- for policies/triggers (Postgres has no CREATE POLICY IF NOT EXISTS).
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  company TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own contacts" ON contacts;
CREATE POLICY "Users can manage own contacts" ON contacts FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own tags" ON tags;
CREATE POLICY "Users can manage own tags" ON tags FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- CONTACT_TAGS (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_tags_contact ON contact_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag ON contact_tags(tag_id);

ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage contact tags" ON contact_tags;
CREATE POLICY "Users can manage contact tags" ON contact_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_tags.contact_id AND contacts.user_id = auth.uid()));

-- ============================================================
-- CUSTOM_FIELDS
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  field_options JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own custom fields" ON custom_fields;
CREATE POLICY "Users can manage own custom fields" ON custom_fields FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- CONTACT_CUSTOM_VALUES
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_custom_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  custom_field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, custom_field_id)
);

ALTER TABLE contact_custom_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage custom values" ON contact_custom_values;
CREATE POLICY "Users can manage custom values" ON contact_custom_values FOR ALL
  USING (EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_custom_values.contact_id AND contacts.user_id = auth.uid()));

-- ============================================================
-- CONTACT_NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own notes" ON contact_notes;
CREATE POLICY "Users can manage own notes" ON contact_notes FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
  assigned_agent_id UUID,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
CREATE POLICY "Users can manage own conversations" ON conversations FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'bot')),
  sender_id UUID,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'document', 'audio', 'video', 'location', 'template')),
  content_text TEXT,
  media_url TEXT,
  template_name TEXT,
  message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Service role can insert messages" ON messages;
CREATE POLICY "Users can view own messages" ON messages FOR ALL
  USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));
CREATE POLICY "Service role can insert messages" ON messages FOR INSERT WITH CHECK (true);

-- ============================================================
-- WHATSAPP_CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  waba_id TEXT,
  access_token TEXT NOT NULL,
  verify_token TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own config" ON whatsapp_config;
CREATE POLICY "Users can manage own config" ON whatsapp_config FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- MESSAGE_TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Marketing' CHECK (category IN ('Marketing', 'Utility', 'Authentication')),
  language TEXT DEFAULT 'en_US',
  header_type TEXT CHECK (header_type IN ('text', 'image', 'video', 'document')),
  header_content TEXT,
  body_text TEXT NOT NULL,
  footer_text TEXT,
  buttons JSONB,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending', 'Approved', 'Rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own templates" ON message_templates;
CREATE POLICY "Users can manage own templates" ON message_templates FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- PIPELINES
-- ============================================================
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own pipelines" ON pipelines;
CREATE POLICY "Users can manage own pipelines" ON pipelines FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- PIPELINE_STAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage pipeline stages" ON pipeline_stages;
CREATE POLICY "Users can manage pipeline stages" ON pipeline_stages FOR ALL
  USING (EXISTS (SELECT 1 FROM pipelines WHERE pipelines.id = pipeline_stages.pipeline_id AND pipelines.user_id = auth.uid()));

-- ============================================================
-- DEALS
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  conversation_id UUID REFERENCES conversations(id),
  title TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  expected_close_date DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deals_pipeline ON deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own deals" ON deals;
CREATE POLICY "Users can manage own deals" ON deals FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- BROADCASTS
-- ============================================================
CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_language TEXT NOT NULL DEFAULT 'en_US',
  template_variables JSONB,
  audience_filter JSONB,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own broadcasts" ON broadcasts;
CREATE POLICY "Users can manage own broadcasts" ON broadcasts FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- BROADCAST_RECIPIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'replied', 'failed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast ON broadcast_recipients(broadcast_id);

ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage broadcast recipients" ON broadcast_recipients;
CREATE POLICY "Users can manage broadcast recipients" ON broadcast_recipients FOR ALL
  USING (EXISTS (SELECT 1 FROM broadcasts WHERE broadcasts.id = broadcast_recipients.broadcast_id AND broadcasts.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at — drop existing triggers first to avoid conflicts
DROP TRIGGER IF EXISTS set_updated_at ON profiles;
DROP TRIGGER IF EXISTS set_updated_at ON contacts;
DROP TRIGGER IF EXISTS set_updated_at ON conversations;
DROP TRIGGER IF EXISTS set_updated_at ON whatsapp_config;
DROP TRIGGER IF EXISTS set_updated_at ON message_templates;
DROP TRIGGER IF EXISTS set_updated_at ON deals;
DROP TRIGGER IF EXISTS set_updated_at ON broadcasts;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON whatsapp_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON message_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON broadcasts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- Uses SECURITY DEFINER with owner=postgres (bypasses RLS).
-- EXCEPTION block ensures signup still succeeds even if profile
-- insert fails — profile can be created later if needed.
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ENABLE REALTIME for key tables (idempotent via DO block)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  END IF;
END $$;

-- ============================================================
-- 002_pipelines_enhancements.sql
-- ============================================================
-- ============================================================
-- Pipeline enhancements:
--   * deals.assigned_to — optional FK to profiles.id
--   * deals.status — CHECK constraint ('open', 'won', 'lost')
--     (replaces the old default 'active' with spec-compliant values)
--
-- Idempotent: safe to run multiple times.
-- ============================================================

-- Add assigned_to (nullable, FK to profiles)
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);

-- Normalize status values: any existing 'active' row becomes 'open'
UPDATE deals SET status = 'open' WHERE status = 'active' OR status IS NULL;

-- Replace the old default and enforce allowed values
ALTER TABLE deals ALTER COLUMN status SET DEFAULT 'open';

-- Drop prior CHECK if any (none in 001, but be idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deals_status_check' AND conrelid = 'deals'::regclass
  ) THEN
    ALTER TABLE deals DROP CONSTRAINT deals_status_check;
  END IF;
END $$;

ALTER TABLE deals
  ADD CONSTRAINT deals_status_check CHECK (status IN ('open', 'won', 'lost'));

-- ============================================================
-- 003_broadcast_recipient_wamid.sql
-- ============================================================
-- ============================================================
-- Broadcast recipient correlation + aggregate counts
--
-- Problem this solves:
--   * broadcast_recipients had no column to correlate with Meta's
--     message id, so webhook status updates (sent/delivered/read)
--     could not be mirrored into the recipient row and the broadcast
--     aggregate counts never advanced.
--   * aggregate counts on `broadcasts` (sent/delivered/read/replied/
--     failed) were updated ad-hoc by the sender, which drifted quickly
--     once webhooks arrived out of band.
--
-- This migration:
--   1. Adds whatsapp_message_id (+ unique index) so webhooks can find
--      a recipient given Meta's message id.
--   2. Adds a composite index on (broadcast_id, status) so the
--      aggregate trigger's COUNT(*) FILTER scans are fast.
--   3. Installs an AFTER INSERT/UPDATE/DELETE trigger on
--      broadcast_recipients that re-aggregates the parent broadcasts
--      row. Keeps writer code trivial — the webhook + hook only touch
--      the recipient row; counts stay consistent automatically.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE broadcast_recipients
  ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;

-- UNIQUE so webhook retries can't create duplicate correlations.
CREATE UNIQUE INDEX IF NOT EXISTS idx_broadcast_recipients_wamid
  ON broadcast_recipients (whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

-- Fast path for the aggregate trigger's COUNT(*) FILTER subqueries.
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast_status
  ON broadcast_recipients (broadcast_id, status);

-- ============================================================
-- Aggregate trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_broadcast_counts(bid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE broadcasts b SET
    sent_count      = agg.sent_count,
    delivered_count = agg.delivered_count,
    read_count      = agg.read_count,
    replied_count   = agg.replied_count,
    failed_count    = agg.failed_count,
    updated_at      = NOW()
  FROM (
    SELECT
      COUNT(*) FILTER (WHERE status IN ('sent','delivered','read','replied')) AS sent_count,
      COUNT(*) FILTER (WHERE status IN ('delivered','read','replied'))        AS delivered_count,
      COUNT(*) FILTER (WHERE status IN ('read','replied'))                    AS read_count,
      COUNT(*) FILTER (WHERE status = 'replied')                              AS replied_count,
      COUNT(*) FILTER (WHERE status = 'failed')                               AS failed_count
    FROM broadcast_recipients
    WHERE broadcast_id = bid
  ) agg
  WHERE b.id = bid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.broadcast_recipient_aggregate_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_broadcast_counts(OLD.broadcast_id);
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE — only recompute when status changed (or on fresh insert)
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.recompute_broadcast_counts(NEW.broadcast_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS broadcast_recipients_aggregate ON broadcast_recipients;
CREATE TRIGGER broadcast_recipients_aggregate
AFTER INSERT OR UPDATE OR DELETE ON broadcast_recipients
FOR EACH ROW EXECUTE FUNCTION public.broadcast_recipient_aggregate_trigger();

-- ============================================================
-- 004_contact_delete_set_null.sql
-- ============================================================
-- ============================================================
-- Allow contact deletion without wiping history.
--
-- broadcast_recipients.contact_id and deals.contact_id were declared
-- NOT NULL REFERENCES contacts(id) with no ON DELETE action, so
-- Postgres defaults to NO ACTION. The first time a user tried to
-- delete a contact that had ever received a broadcast or been
-- attached to a deal, the delete failed with:
--
--   ERROR 23503: update or delete on table "contacts" violates
--   foreign key constraint ... on table <other>
--
-- CASCADE is the wrong fix — it would silently wipe historical
-- broadcast recipient rows (breaking audit + retroactively moving
-- broadcasts.sent_count / delivered_count / read_count etc. via the
-- aggregate trigger) and deal rows.
--
-- SET NULL is the right fix: history rows survive with a NULL
-- contact_id. The UI is already null-safe (contact?.name ?? 'Unknown',
-- contact?.phone, etc.).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ── broadcast_recipients.contact_id ────────────────────────────
ALTER TABLE broadcast_recipients
  ALTER COLUMN contact_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'broadcast_recipients_contact_id_fkey'
      AND conrelid = 'broadcast_recipients'::regclass
  ) THEN
    ALTER TABLE broadcast_recipients
      DROP CONSTRAINT broadcast_recipients_contact_id_fkey;
  END IF;
END $$;

ALTER TABLE broadcast_recipients
  ADD CONSTRAINT broadcast_recipients_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES contacts(id)
    ON DELETE SET NULL;

-- ── deals.contact_id ───────────────────────────────────────────
ALTER TABLE deals
  ALTER COLUMN contact_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deals_contact_id_fkey'
      AND conrelid = 'deals'::regclass
  ) THEN
    ALTER TABLE deals
      DROP CONSTRAINT deals_contact_id_fkey;
  END IF;
END $$;

ALTER TABLE deals
  ADD CONSTRAINT deals_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES contacts(id)
    ON DELETE SET NULL;

-- ============================================================
-- 005_broadcast_counts_incremental.sql
-- ============================================================
-- ============================================================
-- Incremental broadcast aggregate trigger.
--
-- Migration 003 installed a trigger that recomputed every counter
-- (sent/delivered/read/replied/failed) via COUNT(*) FILTER on every
-- row change. For a 10k-recipient broadcast, the send loop produces
-- 10k INSERTs + 10k UPDATEs = 20k full aggregate scans, each walking
-- the (broadcast_id, status) index. Workable at small scale, but
-- O(n²) overall.
--
-- This migration replaces that with an incremental trigger that
-- adjusts the parent broadcast's counts by ±1 based on the OLD →
-- NEW.status delta. O(1) per recipient change; no scans at all.
--
-- Semantic model (same as the lib/broadcast-status.ts "forward-only
-- ladder" in the webhook):
--   sent_count       = recipients whose status is at or past 'sent'
--   delivered_count  = ... at or past 'delivered'
--   read_count       = ... at or past 'read'
--   replied_count    = status = 'replied'
--   failed_count     = status = 'failed'
--
-- A webhook that advances a recipient pending → sent → delivered →
-- read → replied bumps every rung it crosses by 1. Going to 'failed'
-- only bumps failed_count (and can only happen from pending / sent,
-- enforced in the webhook).
--
-- Keeps the safety net: a public recompute_broadcast_counts() SQL
-- function is retained so ops can run it manually if counts ever
-- drift (e.g. after bulk DB surgery).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- Delta a single column by +1 / -1.
CREATE OR REPLACE FUNCTION public._bcast_bump(bid UUID, col TEXT, delta INT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'UPDATE broadcasts SET %I = GREATEST(0, %I + $1), updated_at = NOW() WHERE id = $2',
    col, col
  ) USING delta, bid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Columns this recipient's status contributes to.
CREATE OR REPLACE FUNCTION public._bcast_cols_for_status(s TEXT)
RETURNS TEXT[] AS $$
BEGIN
  -- 'pending' contributes to nothing.
  IF s = 'pending' THEN RETURN ARRAY[]::TEXT[]; END IF;
  IF s = 'sent'      THEN RETURN ARRAY['sent_count']; END IF;
  IF s = 'delivered' THEN RETURN ARRAY['sent_count','delivered_count']; END IF;
  IF s = 'read'      THEN RETURN ARRAY['sent_count','delivered_count','read_count']; END IF;
  IF s = 'replied'   THEN RETURN ARRAY['sent_count','delivered_count','read_count','replied_count']; END IF;
  IF s = 'failed'    THEN RETURN ARRAY['failed_count']; END IF;
  RETURN ARRAY[]::TEXT[];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Replace the trigger body with the incremental version.
CREATE OR REPLACE FUNCTION public.broadcast_recipient_aggregate_trigger()
RETURNS TRIGGER AS $$
DECLARE
  old_cols TEXT[];
  new_cols TEXT[];
  c TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_cols := _bcast_cols_for_status(NEW.status);
    FOREACH c IN ARRAY new_cols LOOP
      PERFORM _bcast_bump(NEW.broadcast_id, c, 1);
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    old_cols := _bcast_cols_for_status(OLD.status);
    FOREACH c IN ARRAY old_cols LOOP
      PERFORM _bcast_bump(OLD.broadcast_id, c, -1);
    END LOOP;
    RETURN OLD;
  END IF;

  -- UPDATE: only care if status changed.
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    old_cols := _bcast_cols_for_status(OLD.status);
    new_cols := _bcast_cols_for_status(NEW.status);
    -- Subtract the old contributions, add the new.
    FOREACH c IN ARRAY old_cols LOOP
      PERFORM _bcast_bump(NEW.broadcast_id, c, -1);
    END LOOP;
    FOREACH c IN ARRAY new_cols LOOP
      PERFORM _bcast_bump(NEW.broadcast_id, c, 1);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger itself remains the same (INSERT/UPDATE/DELETE) — just its
-- body has been replaced.

-- Safety net — rebuild counts from scratch. Retained as-is so ops can
-- run it on demand if something ever drifts. Matches the incremental
-- trigger's semantic model exactly.
CREATE OR REPLACE FUNCTION public.recompute_broadcast_counts(bid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE broadcasts b SET
    sent_count      = agg.sent_count,
    delivered_count = agg.delivered_count,
    read_count      = agg.read_count,
    replied_count   = agg.replied_count,
    failed_count    = agg.failed_count,
    updated_at      = NOW()
  FROM (
    SELECT
      COUNT(*) FILTER (WHERE status IN ('sent','delivered','read','replied')) AS sent_count,
      COUNT(*) FILTER (WHERE status IN ('delivered','read','replied'))        AS delivered_count,
      COUNT(*) FILTER (WHERE status IN ('read','replied'))                    AS read_count,
      COUNT(*) FILTER (WHERE status = 'replied')                              AS replied_count,
      COUNT(*) FILTER (WHERE status = 'failed')                               AS failed_count
    FROM broadcast_recipients
    WHERE broadcast_id = bid
  ) agg
  WHERE b.id = bid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 006_automations.sql
-- ============================================================
-- ============================================================
-- 006_automations.sql — Automations feature
--
-- Idempotent migration — safe to run multiple times.
-- Follows the same conventions as 001_initial_schema.sql:
--   IF NOT EXISTS on tables/indexes, DROP IF EXISTS before
--   re-creating policies/triggers (Postgres has no
--   CREATE POLICY IF NOT EXISTS).
-- ============================================================

-- ============================================================
-- AUTOMATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automations_user_id ON automations(user_id);
-- Partial index tuned for the engine's hot path: find active automations
-- whose trigger_type matches the fired event. RLS then narrows by user_id.
CREATE INDEX IF NOT EXISTS idx_automations_active_trigger
  ON automations(trigger_type) WHERE is_active = TRUE;

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own automations" ON automations;
CREATE POLICY "Users can manage own automations" ON automations FOR ALL
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at ON automations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUTOMATION_STEPS
--
-- `position`       — order within parent scope (root scope or a branch).
-- `parent_step_id` — NULL for root-level steps; set to the Condition
--                    step's id for steps that live inside one of its
--                    branches.
-- `branch`         — NULL for root steps. For children of a Condition,
--                    'yes' or 'no' identifying which path.
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  parent_step_id UUID REFERENCES automation_steps(id) ON DELETE CASCADE,
  branch TEXT CHECK (branch IN ('yes', 'no')),
  step_type TEXT NOT NULL,
  step_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_steps_automation_id
  ON automation_steps(automation_id, position);
CREATE INDEX IF NOT EXISTS idx_automation_steps_parent
  ON automation_steps(parent_step_id) WHERE parent_step_id IS NOT NULL;

ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage steps of own automations" ON automation_steps;
CREATE POLICY "Users can manage steps of own automations" ON automation_steps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM automations a
      WHERE a.id = automation_steps.automation_id
        AND a.user_id = auth.uid()
    )
  );

-- ============================================================
-- AUTOMATION_LOGS
--
-- user_id is denormalized for simple RLS; contact_id is nullable so
-- history survives contact deletion (mirrors migration 004's pattern
-- on broadcast_recipients / deals).
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  trigger_event TEXT NOT NULL,
  steps_executed JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_automation
  ON automation_logs(automation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_user ON automation_logs(user_id);

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own automation logs" ON automation_logs;
CREATE POLICY "Users can view own automation logs" ON automation_logs FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================
-- AUTOMATION_PENDING_EXECUTIONS
--
-- Queue row created when a running automation hits a `wait` step.
-- The cron endpoint drains rows where run_at <= now() and status =
-- 'pending', flips them to 'running', and resumes the automation
-- from `next_step_position` with the saved `context` jsonb.
--
-- Service-role only — writes never originate from the browser, and
-- the engine uses the service-role client. No user policy exposed.
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_pending_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  log_id UUID REFERENCES automation_logs(id) ON DELETE CASCADE,
  parent_step_id UUID REFERENCES automation_steps(id) ON DELETE SET NULL,
  branch TEXT CHECK (branch IN ('yes', 'no')),
  next_step_position INTEGER NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'failed')),
  run_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_pending_due
  ON automation_pending_executions(run_at) WHERE status = 'pending';

ALTER TABLE automation_pending_executions ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policy for authenticated users — all
-- access is server-side via the service-role key.

-- ============================================================
-- 007_automations_increment_counter.sql
-- ============================================================
-- ============================================================
-- 007_automations_increment_counter.sql
--
-- Atomic increment of automations.execution_count + refresh of
-- last_executed_at. Called via PostgREST RPC from the engine.
--
-- Before this, the engine did a read-modify-write:
--   UPDATE automations SET execution_count = <cached + 1> WHERE id = ...
-- so two concurrent dispatches (e.g. the same automation firing for
-- two different contacts in the same second) could both read N and
-- both write N+1, permanently losing one count.
--
-- Idempotent — safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION increment_automation_execution_count(p_automation_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE automations
  SET
    execution_count = execution_count + 1,
    last_executed_at = NOW()
  WHERE id = p_automation_id;
$$;

-- Only the service role needs to call this (engine uses the
-- service-role client). Explicitly lock anon / authenticated out so
-- an authenticated user can't juice someone else's counter via RPC.
REVOKE ALL ON FUNCTION increment_automation_execution_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_automation_execution_count(UUID) FROM anon;
REVOKE ALL ON FUNCTION increment_automation_execution_count(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION increment_automation_execution_count(UUID) TO service_role;

-- ============================================================
-- 008_profile_avatars_storage.sql
-- ============================================================
-- ============================================================
-- 008_profile_avatars_storage.sql
--
-- Creates the `avatars` Supabase Storage bucket and the RLS policies
-- that let each user manage only their own avatar file while letting
-- everyone read (so rendering <img> tags without signed URLs works).
--
-- File path convention used by the app:
--   avatars/{auth.uid()}/avatar-<timestamp>.<ext>
-- The policies rely on the first path segment matching auth.uid()::text.
--
-- Idempotent — safe to re-run.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  2097152, -- 2 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies live on storage.objects. Drop-if-exists because Postgres
-- has no CREATE POLICY IF NOT EXISTS, and we want this migration to
-- re-run cleanly.
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
CREATE POLICY "Avatars are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- 009_org_tenancy.sql
-- ============================================================
-- ============================================================
-- 009 — Organization tenancy + SSO entitlements
--
-- Turns the single-user wacrm template into a multi-tenant SaaS.
-- Every user-scoped row gains an `org_id`; RLS is rewritten so that
-- members of an organization share its data.
--
-- Design note — why existing API routes keep working unchanged:
-- routes still INSERT only `user_id`. A BEFORE INSERT trigger
-- (`set_org_id`) fills `org_id` from the inserting user's primary
-- org membership, so no route rewrite is required for correctness.
-- The route layer can later set `org_id` explicitly; the trigger is
-- a no-op when it is already populated.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  -- SSO / entitlement fields asserted by Memberistic + Licenseistic.
  sso_subject TEXT UNIQUE,            -- stable WordPress user/site id
  plan TEXT NOT NULL DEFAULT 'free',
  license_key TEXT,
  license_status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (license_status IN ('active', 'inactive', 'expired', 'suspended')),
  agent_limit INTEGER NOT NULL DEFAULT 1,
  widget_limit INTEGER NOT NULL DEFAULT 1,
  domain_limit INTEGER NOT NULL DEFAULT 1,
  allowed_domains TEXT[] NOT NULL DEFAULT '{}',
  entitlements_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ORG MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'agent'
    CHECK (role IN ('owner', 'admin', 'agent')),
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);

ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER — org ids the current user belongs to.
-- SECURITY DEFINER so it bypasses RLS on org_members; this avoids
-- infinite recursion when org_members' own policy references it.
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_primary_org(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM org_members
  WHERE user_id = p_user_id
  ORDER BY is_primary DESC, created_at ASC
  LIMIT 1;
$$;

-- Policies for organizations / org_members.
DROP POLICY IF EXISTS "Members can view their organizations" ON organizations;
CREATE POLICY "Members can view their organizations" ON organizations
  FOR SELECT USING (id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS "Members can view org membership" ON org_members;
CREATE POLICY "Members can view org membership" ON org_members
  FOR SELECT USING (org_id IN (SELECT public.user_org_ids()));

-- ============================================================
-- ADD org_id TO TENANT TABLES + BACKFILL + RLS REWRITE
-- ============================================================
DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'contacts', 'tags', 'custom_fields', 'contact_notes',
    'conversations', 'whatsapp_config', 'message_templates',
    'pipelines', 'deals', 'broadcasts', 'automations', 'automation_logs'
  ];
BEGIN
  -- One personal organization per existing user.
  INSERT INTO organizations (name, sso_subject)
  SELECT COALESCE(p.full_name, p.email, 'Organization'), 'legacy:' || u.id
  FROM auth.users u
  LEFT JOIN profiles p ON p.user_id = u.id
  WHERE NOT EXISTS (
    SELECT 1 FROM org_members m WHERE m.user_id = u.id
  )
  ON CONFLICT (sso_subject) DO NOTHING;

  INSERT INTO org_members (org_id, user_id, role, is_primary)
  SELECT o.id, u.id, 'owner', TRUE
  FROM auth.users u
  JOIN organizations o ON o.sso_subject = 'legacy:' || u.id
  WHERE NOT EXISTS (
    SELECT 1 FROM org_members m WHERE m.user_id = u.id
  )
  ON CONFLICT (org_id, user_id) DO NOTHING;

  FOREACH t IN ARRAY tenant_tables LOOP
    -- Skip tables that don't exist yet (e.g. automations on a fresh DB
    -- where 006 hasn't run — these arrays are defensive).
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE',
      t
    );

    -- Backfill org_id from the row owner's primary org.
    EXECUTE format(
      'UPDATE %I tbl SET org_id = public.user_primary_org(tbl.user_id) WHERE org_id IS NULL',
      t
    );

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_org ON %I(org_id)', t, t);

    -- Drop every legacy user-scoped policy on the table, then install
    -- one org-scoped ALL policy.
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage own %s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Org members manage %s" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "Org members manage %s" ON %I FOR ALL '
      || 'USING (org_id IN (SELECT public.user_org_ids())) '
      || 'WITH CHECK (org_id IN (SELECT public.user_org_ids()))',
      t, t
    );
  END LOOP;
END $$;

-- contacts / conversations / templates had bespoke policy names — drop
-- any that survived the generic DROP above.
DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can manage own templates" ON message_templates;
DROP POLICY IF EXISTS "Users can manage own config" ON whatsapp_config;
DROP POLICY IF EXISTS "Users can manage own deals" ON deals;
DROP POLICY IF EXISTS "Users can manage own broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "Users can manage own pipelines" ON pipelines;
DROP POLICY IF EXISTS "Users can manage own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can manage own tags" ON tags;
DROP POLICY IF EXISTS "Users can manage own custom fields" ON custom_fields;
DROP POLICY IF EXISTS "Users can manage own notes" ON contact_notes;

-- ============================================================
-- BEFORE INSERT TRIGGER — auto-fill org_id from the user's primary org.
-- Keeps existing API routes (which only set user_id) working unchanged.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.user_primary_org(
      COALESCE(NEW.user_id, auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'contacts', 'tags', 'custom_fields', 'contact_notes',
    'conversations', 'whatsapp_config', 'message_templates',
    'pipelines', 'deals', 'broadcasts', 'automations', 'automation_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS set_org_id ON %I', t);
      EXECUTE format(
        'CREATE TRIGGER set_org_id BEFORE INSERT ON %I '
        || 'FOR EACH ROW EXECUTE FUNCTION public.set_org_id()',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- UPDATED_AT on organizations
-- ============================================================
DROP TRIGGER IF EXISTS set_updated_at ON organizations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUTO-PROVISION org on signup.
-- Replaces handle_new_user from 001: still creates the profile, and
-- now also creates a personal organization + owner membership so the
-- set_org_id trigger always has an org to point at.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );

  INSERT INTO public.organizations (name, sso_subject)
  VALUES (
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'Organization'),
    'legacy:' || NEW.id
  )
  ON CONFLICT (sso_subject) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO new_org_id;

  INSERT INTO public.org_members (org_id, user_id, role, is_primary)
  VALUES (new_org_id, NEW.id, 'owner', TRUE)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to provision user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- ============================================================
-- 010_whatsapp_provider.sql
-- ============================================================
-- ============================================================
-- 010 — Dual-provider WhatsApp configuration
--
-- Adds a `provider` discriminator to whatsapp_config plus the
-- Twilio-specific credential columns. Meta columns (phone_number_id,
-- waba_id, access_token, verify_token) stay as-is; existing rows
-- default to provider = 'meta'.
--
-- twilio_auth_token is encrypted at rest with the same AES-256-GCM
-- helper as the Meta access_token (src/lib/whatsapp/encryption.ts).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'meta'
    CHECK (provider IN ('meta', 'twilio'));

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS twilio_account_sid TEXT;

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS twilio_auth_token TEXT;        -- encrypted

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS twilio_whatsapp_number TEXT;   -- E.164, the "from"

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS twilio_messaging_service_sid TEXT;

-- The Meta columns are NOT NULL in 001. A Twilio-only config has no
-- Meta credentials, so relax them — provider-level validation lives
-- in the API route and the provider adapters.
ALTER TABLE whatsapp_config ALTER COLUMN phone_number_id DROP NOT NULL;
ALTER TABLE whatsapp_config ALTER COLUMN access_token DROP NOT NULL;

-- ============================================================
-- 011_ai_knowledge_base.sql
-- ============================================================
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

-- ============================================================
-- 012_org_saas_entitlements.sql
-- ============================================================
-- ============================================================
-- 012 — SaaS plan entitlements on organizations
--
-- The Memberistic SaaS connector asserts two more plan-derived
-- entitlements in the SSO token: the monthly active-contact cap and
-- the white-label flag. Migration 009 already stores plan + agent/
-- widget/domain limits; this adds the remaining two columns.
--
-- Convention: contact_limit = 0 means "unlimited".
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS contact_limit INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS white_label BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN organizations.contact_limit IS
  'Monthly active-contact cap from the membership plan. 0 = unlimited.';
COMMENT ON COLUMN organizations.white_label IS
  'Whether the plan ships the fully white-labelled chat widget.';

-- ============================================================
-- 013_sms_gateway_provider.sql
-- ============================================================
-- ============================================================
-- 013 — Self-hosted SMS gateway provider (Jasmin)
--
-- Adds 'jasmin' as a third value for whatsapp_config.provider and the
-- gateway-specific connection columns. Jasmin is an open-source SMPP
-- gateway the tenant self-hosts; the CRM talks to its HTTP API.
--
-- jasmin_password is encrypted at rest with the same AES-256-GCM helper
-- as the other provider secrets (src/lib/whatsapp/encryption.ts).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- Migration 010 created an inline CHECK constraint allowing only
-- ('meta','twilio'). Drop and recreate it to admit 'jasmin'.
ALTER TABLE whatsapp_config
  DROP CONSTRAINT IF EXISTS whatsapp_config_provider_check;

ALTER TABLE whatsapp_config
  ADD CONSTRAINT whatsapp_config_provider_check
  CHECK (provider IN ('meta', 'twilio', 'jasmin'));

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS jasmin_base_url TEXT;          -- e.g. https://sms.example.com

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS jasmin_username TEXT;

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS jasmin_password TEXT;          -- encrypted

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS jasmin_default_sender TEXT;    -- sender ID / number

-- ============================================================
-- 014_sms_compliance.sql
-- ============================================================
-- ============================================================
-- 014 — SMS compliance layer
--
-- TCPA / carrier-compliance support for the SMS gateway provider:
--   * sms_consent      — per-contact opt-in / opt-out state with the
--                        evidence needed to defend a TCPA claim
--                        (timestamp, source, IP, age confirmation).
--   * sms_audit_log    — append-only record of every SMS sent and
--                        received, for dispute resolution and audits.
--   * quiet-hours columns on whatsapp_config — block outbound SMS
--                        outside an allowed local-time window.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- SMS_CONSENT
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_consent (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'opted_in', 'opted_out')),
  opted_in_at TIMESTAMPTZ,
  opt_in_source TEXT,        -- 'web_form' | 'pos' | 'keyword' | 'import' | ...
  opt_in_ip TEXT,
  age_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  opted_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_consent_user_id ON sms_consent(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_consent_contact_id ON sms_consent(contact_id);

ALTER TABLE sms_consent ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own sms consent" ON sms_consent;
CREATE POLICY "Users can manage own sms consent" ON sms_consent FOR ALL
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- SMS_AUDIT_LOG  (append-only)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  phone TEXT NOT NULL,
  body TEXT,
  message_id TEXT,
  status TEXT,                -- 'sent' | 'blocked' | 'delivered' | 'received' | ...
  block_reason TEXT,          -- set when an outbound send was blocked
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_audit_user_created
  ON sms_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_audit_contact_id ON sms_audit_log(contact_id);

ALTER TABLE sms_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own sms audit log" ON sms_audit_log;
CREATE POLICY "Users can view own sms audit log" ON sms_audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- QUIET HOURS on whatsapp_config
-- ------------------------------------------------------------
-- Outbound SMS is blocked when the tenant's local time is within
-- [start, end). A NULL start or end disables the quiet-hours check.
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS sms_quiet_hours_start INTEGER
    CHECK (sms_quiet_hours_start BETWEEN 0 AND 23);

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS sms_quiet_hours_end INTEGER
    CHECK (sms_quiet_hours_end BETWEEN 0 AND 23);

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS sms_timezone TEXT NOT NULL DEFAULT 'America/New_York';

-- ============================================================
-- 015_sms_a2p_registration.sql
-- ============================================================
-- ============================================================
-- 015 — A2P / TCR registration tracking
--
-- For the multi-tenant SMS SaaS: each tenant must register an A2P
-- brand and campaign with The Campaign Registry before sending
-- production traffic. These columns let the CRM record and surface
-- that registration state per tenant.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS a2p_brand_id TEXT;

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS a2p_campaign_id TEXT;

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS a2p_status TEXT NOT NULL DEFAULT 'unregistered'
    CHECK (a2p_status IN ('unregistered', 'pending', 'registered', 'rejected'));

-- ============================================================
-- 016_sms_broadcast.sql
-- ============================================================
-- ============================================================
-- 016 — SMS broadcast support
--
-- WhatsApp broadcasts send a pre-approved template; SMS broadcasts
-- send free-form text. This migration lets a broadcast row carry
-- either:
--   * message_text  — the SMS body (NULL for WhatsApp broadcasts).
--   * template_name — relaxed to nullable so an SMS broadcast, which
--                     has no template, can omit it.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS message_text TEXT;

ALTER TABLE broadcasts
  ALTER COLUMN template_name DROP NOT NULL;

-- ============================================================
-- 017_sms_consent_widget.sql
-- ============================================================
-- ============================================================
-- 017 — SMS consent-capture widget
--
-- Adds a per-tenant public key that identifies the hosted SMS opt-in
-- form (/sms-optin/<key>). A contact submitting that form is recorded
-- as opted in with source = 'web_form' — the express-consent evidence
-- the SMS send gate requires.
--
-- The key is a public identifier, not a secret: it only lets someone
-- submit an opt-in for that tenant, never read data.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS sms_widget_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_config_widget_key
  ON whatsapp_config (sms_widget_key)
  WHERE sms_widget_key IS NOT NULL;

-- ============================================================
-- 018_contact_phone_norm_and_conversation_uniques.sql
-- ============================================================
-- ============================================================
-- 018 - Contact phone normalization + conversation dedupe
--
-- Goals:
-- 1) Speed inbound webhook contact matching by indexing normalized phones.
-- 2) Prevent duplicate conversations for the same (user_id, contact_id)
--    under concurrent webhook deliveries.
--
-- Idempotent and safe to re-run.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT;

-- Backfill any existing contacts.
UPDATE contacts
SET phone_normalized = regexp_replace(coalesce(phone, ''), '\D', '', 'g')
WHERE phone_normalized IS NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_user_phone_normalized
  ON contacts(user_id, phone_normalized);

-- Remove duplicates before enforcing uniqueness.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, contact_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM conversations
)
DELETE FROM conversations c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_conversations_user_contact
  ON conversations(user_id, contact_id);


-- ============================================================
-- 019_sms_policy_preflight_and_consent_events.sql
-- ============================================================
-- ============================================================
-- 019 - SMS consent evidence model + policy primitives
--
-- Adds:
-- 1) richer evidence columns on sms_consent
-- 2) append-only sms_consent_events ledger
--
-- Idempotent - safe to run multiple times.
-- ============================================================

ALTER TABLE sms_consent
  ADD COLUMN IF NOT EXISTS legal_text_version TEXT;

ALTER TABLE sms_consent
  ADD COLUMN IF NOT EXISTS opt_in_user_agent TEXT;

ALTER TABLE sms_consent
  ADD COLUMN IF NOT EXISTS opt_out_source TEXT;

CREATE TABLE IF NOT EXISTS sms_consent_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('opt_in', 'opt_out', 'help', 'start', 'stop')),
  source TEXT,
  legal_text_version TEXT,
  evidence_ip TEXT,
  evidence_user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_consent_events_user_created
  ON sms_consent_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_consent_events_contact
  ON sms_consent_events(contact_id, created_at DESC);

ALTER TABLE sms_consent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sms consent events" ON sms_consent_events;
CREATE POLICY "Users can view own sms consent events" ON sms_consent_events FOR SELECT
  USING (auth.uid() = user_id);


-- ============================================================
-- 020_tochat_org_config.sql
-- ============================================================
-- 020_tochat_org_config.sql
-- Per-org white-label (tochat.be) integration state.
--
-- Two isolation modes, resolved in src/lib/tochat/org-config.ts:
--
--   isolated  — the org stored its own white-label account credentials
--               (email + password_encrypted). Every API call runs under
--               that account's JWT, so the upstream scopes reads/writes
--               to the org's own widgets. No tagging needed.
--
--   shared    — no per-org credentials; the deployment-wide master
--               account (TOCHAT_API_EMAIL / TOCHAT_API_PASSWORD) is
--               used and every query is filtered by the org's
--               `user_client` tag.
--
-- `user_client` is the tag applied to widgets created through the
-- WordPress connector ('cbc-{wp_user_id}') or this app ('org-{uuid}').
-- SSO-provisioned orgs inherit the WordPress tag so widgets created in
-- the member portal stay visible in the dashboard, and vice versa.

create table if not exists public.tochat_org_config (
  org_id uuid primary key
    references public.organizations (id) on delete cascade,
  user_client text not null default '',
  email text,
  password_encrypted text,
  api_base text,
  leads_api_key_encrypted text,
  connected_at timestamptz,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on column public.tochat_org_config.user_client is
  'userClient tag scoping this org inside the shared white-label account (cbc-{wpUserId} or org-{uuid}).';
comment on column public.tochat_org_config.password_encrypted is
  'AES-256-GCM ciphertext (src/lib/whatsapp/encryption.ts format).';
comment on column public.tochat_org_config.leads_api_key_encrypted is
  'Optional per-org leads API key (GET /api/get-json-lead).';

alter table public.tochat_org_config enable row level security;

drop policy if exists "tochat_org_config_org_scoped" on public.tochat_org_config;
create policy "tochat_org_config_org_scoped"
  on public.tochat_org_config
  for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- Seed a tag row for every existing org (idempotent).
insert into public.tochat_org_config (org_id, user_client)
select id, 'org-' || id::text
from public.organizations
on conflict (org_id) do nothing;

-- Safety net for rows created before the default applied.
update public.tochat_org_config
set user_client = 'org-' || org_id::text
where user_client = '';

-- ============================================================
-- 021_org_autoprovision.sql
-- ============================================================
-- ============================================================
-- 021 — Auto-provision an organization for every signup
--
-- Problem: users who sign up directly at /signup get a profile but
-- NO organization, so every org-scoped API call returns
-- "No organization for this account" (404) and the dashboard is
-- unusable until an SSO login happens to create one.
--
-- Fix: extend the existing on_auth_user_created trigger to also
-- create a personal org + owner membership when the new user has
-- none. Idempotent — safe to run multiple times.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );

  -- Personal workspace: every confirmed signup gets an org they own,
  -- so the dashboard works immediately after email confirmation.
  IF NOT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = NEW.id) THEN
    INSERT INTO public.organizations (name, slug, plan)
    VALUES (
      COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
        split_part(NEW.email, '@', 1) || '''s workspace'
      ),
      NULL,
      'free'
    )
    RETURNING id INTO new_org_id;

    INSERT INTO public.org_members (org_id, user_id, role, is_primary)
    VALUES (new_org_id, NEW.id, 'owner', TRUE);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to provision signup for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Re-assert the trigger binding (no-op if it already exists and is
-- bound to this function name — CREATE TRIGGER lacks IF NOT EXISTS,
-- so drop-and-recreate is the idempotent pattern used in 001).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 022_org_licenses.sql
-- ============================================================
-- ============================================================
-- 022 — Per-org license records (WPistic license server link)
--
-- The org's SaaS entitlements (plan, widget_limit, …) stay on
-- `organizations` — that is what the app enforces. This table keeps
-- the *activation* side: which license key the org activated in this
-- CRM, what the WPistic license server last said about it, and when
-- we last checked. One row per org (the CRM activates at most one
-- Chatbotistic license per workspace).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_licenses (
  org_id uuid PRIMARY KEY
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  license_key_mask TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive', 'expired', 'suspended', 'grace_period', 'activation_suspended')),
  product TEXT,
  plan TEXT,
  expires_at TIMESTAMPTZ,
  activation_domain TEXT,
  entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.org_licenses.license_key_mask IS
  'Masked license key (e.g. WPIST-****-****-3F7A) — the raw key is never stored, only a SHA-256 hash.';
COMMENT ON COLUMN public.org_licenses.entitlements IS
  'Snapshot of the entitlement map from the last successful activation/validation response.';

-- Raw-key hash for re-validation without asking the user again.
ALTER TABLE public.org_licenses
  ADD COLUMN IF NOT EXISTS license_key_hash TEXT;

-- Encrypted activation token (AES-256-GCM via the app's ENCRYPTION_KEY)
-- used for server-side re-validate / deactivate. Never returned to the
-- client — only decrypted inside the licensing API routes.
ALTER TABLE public.org_licenses
  ADD COLUMN IF NOT EXISTS activation_token_encrypted TEXT;

CREATE INDEX IF NOT EXISTS idx_org_licenses_status ON public.org_licenses (status);

-- RLS: org members can read their own license row; writes only via
-- service role (the activation API route runs server-side).
ALTER TABLE public.org_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_licenses_read ON public.org_licenses;
CREATE POLICY org_licenses_read ON public.org_licenses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = org_licenses.org_id AND m.user_id = auth.uid()
    )
  );
