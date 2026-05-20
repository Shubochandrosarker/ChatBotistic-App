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
