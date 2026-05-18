-- ============================================================
-- 009 — Organization tenancy + SSO entitlements
--
-- Turns the single-user wacrm template into a multi-tenant SaaS.
-- Every user-scoped row gains an `org_id`; RLS is rewritten so that
-- members of an organization share its data.
--
-- Design note — why existing API routes keep working unchanged:
-- routes still INSERT only `user_id`. A BEFORE INSERT trigger
-- (`set_org_id`) fills `org_id` from the inserting user's primary
-- org membership, so no route rewrite is required for correctness.
-- The route layer can later set `org_id` explicitly; the trigger is
-- a no-op when it is already populated.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  -- SSO / entitlement fields asserted by Memberistic + Licenseistic.
  sso_subject TEXT UNIQUE,            -- stable WordPress user/site id
  plan TEXT NOT NULL DEFAULT 'free',
  license_key TEXT,
  license_status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (license_status IN ('active', 'inactive', 'expired', 'suspended')),
  agent_limit INTEGER NOT NULL DEFAULT 1,
  widget_limit INTEGER NOT NULL DEFAULT 1,
  domain_limit INTEGER NOT NULL DEFAULT 1,
  allowed_domains TEXT[] NOT NULL DEFAULT '{}',
  entitlements_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ORG MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'agent'
    CHECK (role IN ('owner', 'admin', 'agent')),
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);

ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER — org ids the current user belongs to.
-- SECURITY DEFINER so it bypasses RLS on org_members; this avoids
-- infinite recursion when org_members' own policy references it.
-- ============================================================
CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_primary_org(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM org_members
  WHERE user_id = p_user_id
  ORDER BY is_primary DESC, created_at ASC
  LIMIT 1;
$$;

-- Policies for organizations / org_members.
DROP POLICY IF EXISTS "Members can view their organizations" ON organizations;
CREATE POLICY "Members can view their organizations" ON organizations
  FOR SELECT USING (id IN (SELECT public.user_org_ids()));

DROP POLICY IF EXISTS "Members can view org membership" ON org_members;
CREATE POLICY "Members can view org membership" ON org_members
  FOR SELECT USING (org_id IN (SELECT public.user_org_ids()));

-- ============================================================
-- ADD org_id TO TENANT TABLES + BACKFILL + RLS REWRITE
-- ============================================================
DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'contacts', 'tags', 'custom_fields', 'contact_notes',
    'conversations', 'whatsapp_config', 'message_templates',
    'pipelines', 'deals', 'broadcasts', 'automations', 'automation_logs'
  ];
BEGIN
  -- One personal organization per existing user.
  INSERT INTO organizations (name, sso_subject)
  SELECT COALESCE(p.full_name, p.email, 'Organization'), 'legacy:' || u.id
  FROM auth.users u
  LEFT JOIN profiles p ON p.user_id = u.id
  WHERE NOT EXISTS (
    SELECT 1 FROM org_members m WHERE m.user_id = u.id
  )
  ON CONFLICT (sso_subject) DO NOTHING;

  INSERT INTO org_members (org_id, user_id, role, is_primary)
  SELECT o.id, u.id, 'owner', TRUE
  FROM auth.users u
  JOIN organizations o ON o.sso_subject = 'legacy:' || u.id
  WHERE NOT EXISTS (
    SELECT 1 FROM org_members m WHERE m.user_id = u.id
  )
  ON CONFLICT (org_id, user_id) DO NOTHING;

  FOREACH t IN ARRAY tenant_tables LOOP
    -- Skip tables that don't exist yet (e.g. automations on a fresh DB
    -- where 006 hasn't run — these arrays are defensive).
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE',
      t
    );

    -- Backfill org_id from the row owner's primary org.
    EXECUTE format(
      'UPDATE %I tbl SET org_id = public.user_primary_org(tbl.user_id) WHERE org_id IS NULL',
      t
    );

    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_org ON %I(org_id)', t, t);

    -- Drop every legacy user-scoped policy on the table, then install
    -- one org-scoped ALL policy.
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage own %s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Org members manage %s" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "Org members manage %s" ON %I FOR ALL '
      || 'USING (org_id IN (SELECT public.user_org_ids())) '
      || 'WITH CHECK (org_id IN (SELECT public.user_org_ids()))',
      t, t
    );
  END LOOP;
END $$;

-- contacts / conversations / templates had bespoke policy names — drop
-- any that survived the generic DROP above.
DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can manage own templates" ON message_templates;
DROP POLICY IF EXISTS "Users can manage own config" ON whatsapp_config;
DROP POLICY IF EXISTS "Users can manage own deals" ON deals;
DROP POLICY IF EXISTS "Users can manage own broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "Users can manage own pipelines" ON pipelines;
DROP POLICY IF EXISTS "Users can manage own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can manage own tags" ON tags;
DROP POLICY IF EXISTS "Users can manage own custom fields" ON custom_fields;
DROP POLICY IF EXISTS "Users can manage own notes" ON contact_notes;

-- ============================================================
-- BEFORE INSERT TRIGGER — auto-fill org_id from the user's primary org.
-- Keeps existing API routes (which only set user_id) working unchanged.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.user_primary_org(
      COALESCE(NEW.user_id, auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
  tenant_tables TEXT[] := ARRAY[
    'contacts', 'tags', 'custom_fields', 'contact_notes',
    'conversations', 'whatsapp_config', 'message_templates',
    'pipelines', 'deals', 'broadcasts', 'automations', 'automation_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS set_org_id ON %I', t);
      EXECUTE format(
        'CREATE TRIGGER set_org_id BEFORE INSERT ON %I '
        || 'FOR EACH ROW EXECUTE FUNCTION public.set_org_id()',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- UPDATED_AT on organizations
-- ============================================================
DROP TRIGGER IF EXISTS set_updated_at ON organizations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUTO-PROVISION org on signup.
-- Replaces handle_new_user from 001: still creates the profile, and
-- now also creates a personal organization + owner membership so the
-- set_org_id trigger always has an org to point at.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );

  INSERT INTO public.organizations (name, sso_subject)
  VALUES (
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'Organization'),
    'legacy:' || NEW.id
  )
  ON CONFLICT (sso_subject) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO new_org_id;

  INSERT INTO public.org_members (org_id, user_id, role, is_primary)
  VALUES (new_org_id, NEW.id, 'owner', TRUE)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to provision user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
