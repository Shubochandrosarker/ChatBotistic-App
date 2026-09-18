-- ============================================================
-- 021 — Auto-provision an organization for every signup
--
-- Problem: users who sign up directly at /signup get a profile but
-- NO organization, so every org-scoped API call returns
-- "No organization for this account" (404) and the dashboard is
-- unusable until an SSO login happens to create one.
--
-- Fix: extend the existing on_auth_user_created trigger to also
-- create a personal org + owner membership when the new user has
-- none. Idempotent — safe to run multiple times.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );

  -- Personal workspace: every confirmed signup gets an org they own,
  -- so the dashboard works immediately after email confirmation.
  IF NOT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = NEW.id) THEN
    INSERT INTO public.organizations (name, slug, plan)
    VALUES (
      COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
        split_part(NEW.email, '@', 1) || '''s workspace'
      ),
      NULL,
      'free'
    )
    RETURNING id INTO new_org_id;

    INSERT INTO public.org_members (org_id, user_id, role, is_primary)
    VALUES (new_org_id, NEW.id, 'owner', TRUE);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to provision signup for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Re-assert the trigger binding (no-op if it already exists and is
-- bound to this function name — CREATE TRIGGER lacks IF NOT EXISTS,
-- so drop-and-recreate is the idempotent pattern used in 001).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
