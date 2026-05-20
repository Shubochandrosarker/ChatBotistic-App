-- ============================================================
-- 015 — A2P / TCR registration tracking
--
-- For the multi-tenant SMS SaaS: each tenant must register an A2P
-- brand and campaign with The Campaign Registry before sending
-- production traffic. These columns let the CRM record and surface
-- that registration state per tenant.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS a2p_brand_id TEXT;

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS a2p_campaign_id TEXT;

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS a2p_status TEXT NOT NULL DEFAULT 'unregistered'
    CHECK (a2p_status IN ('unregistered', 'pending', 'registered', 'rejected'));
