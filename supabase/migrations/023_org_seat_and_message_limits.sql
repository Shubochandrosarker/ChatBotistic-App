-- ============================================================
-- 023 — Seat and monthly-message entitlements on organizations
--
-- The pricing page advertises per-plan seat counts ("1 domain · 1
-- seat", "3 domains · 2 seats", …) and monthly message allowances
-- ("100 messages / month", …). Migration 009/012 already store plan,
-- agent/widget/domain limits, contact_limit and white_label; widget
-- and agent caps are enforced at create-time. This adds the two
-- remaining advertised entitlements so they can be enforced
-- server-side too:
--
--   seat_limit     — max org_members rows (enforced when member
--                    invites ship; provisioning already creates
--                    exactly one owner).
--   message_limit  — max outbound WhatsApp/SMS messages per calendar
--                    month (counted from the messages table, enforced
--                    in /api/whatsapp/send and /api/whatsapp/broadcast).
--
-- Limit semantics mirror the other INTEGER limits: any negative value
-- means unlimited. Defaults match the Free plan (1 seat, 100
-- messages).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS seat_limit INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS message_limit INTEGER NOT NULL DEFAULT 100;

COMMENT ON COLUMN organizations.seat_limit IS
  'Max org members from the membership plan. Negative = unlimited.';
COMMENT ON COLUMN organizations.message_limit IS
  'Max outbound messages per calendar month from the plan. Negative = unlimited.';
