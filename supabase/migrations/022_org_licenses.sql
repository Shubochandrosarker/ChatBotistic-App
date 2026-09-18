-- ============================================================
-- 022 — Per-org license records (WPistic license server link)
--
-- The org's SaaS entitlements (plan, widget_limit, …) stay on
-- `organizations` — that is what the app enforces. This table keeps
-- the *activation* side: which license key the org activated in this
-- CRM, what the WPistic license server last said about it, and when
-- we last checked. One row per org (the CRM activates at most one
-- Chatbotistic license per workspace).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_licenses (
  org_id uuid PRIMARY KEY
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  license_key_mask TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive', 'expired', 'suspended', 'grace_period', 'activation_suspended')),
  product TEXT,
  plan TEXT,
  expires_at TIMESTAMPTZ,
  activation_domain TEXT,
  entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.org_licenses.license_key_mask IS
  'Masked license key (e.g. WPIST-****-****-3F7A) — the raw key is never stored, only a SHA-256 hash.';
COMMENT ON COLUMN public.org_licenses.entitlements IS
  'Snapshot of the entitlement map from the last successful activation/validation response.';

-- Raw-key hash for re-validation without asking the user again.
ALTER TABLE public.org_licenses
  ADD COLUMN IF NOT EXISTS license_key_hash TEXT;

-- Encrypted activation token (AES-256-GCM via the app's ENCRYPTION_KEY)
-- used for server-side re-validate / deactivate. Never returned to the
-- client — only decrypted inside the licensing API routes.
ALTER TABLE public.org_licenses
  ADD COLUMN IF NOT EXISTS activation_token_encrypted TEXT;

CREATE INDEX IF NOT EXISTS idx_org_licenses_status ON public.org_licenses (status);

-- RLS: org members can read their own license row; writes only via
-- service role (the activation API route runs server-side).
ALTER TABLE public.org_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_licenses_read ON public.org_licenses;
CREATE POLICY org_licenses_read ON public.org_licenses
  FOR SELECT
  USING (org_id IN (SELECT public.user_org_ids()));
