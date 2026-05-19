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
