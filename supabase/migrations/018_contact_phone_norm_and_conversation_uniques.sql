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

