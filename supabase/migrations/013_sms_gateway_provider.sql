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
