-- ============================================================
-- 012 — SaaS plan entitlements on organizations
--
-- The Memberistic SaaS connector now asserts two more plan-derived
-- entitlements in the SSO token: the monthly conversation cap and the
-- white-label flag. Migration 009 already stores plan + agent/widget/
-- domain limits; this adds the remaining two columns.
--
-- Convention: conversation_limit = 0 means "unlimited" (Agency tier).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS conversation_limit INTEGER NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS white_label BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN organizations.conversation_limit IS
  'Monthly conversation cap from the membership plan. 0 = unlimited.';
COMMENT ON COLUMN organizations.white_label IS
  'Whether the plan removes Chatbotistic/CRM branding.';
