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

