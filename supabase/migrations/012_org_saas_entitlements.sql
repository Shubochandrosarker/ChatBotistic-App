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
