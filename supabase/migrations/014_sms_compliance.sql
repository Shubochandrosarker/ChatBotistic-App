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
