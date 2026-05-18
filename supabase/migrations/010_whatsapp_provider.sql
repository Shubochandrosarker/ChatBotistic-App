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
