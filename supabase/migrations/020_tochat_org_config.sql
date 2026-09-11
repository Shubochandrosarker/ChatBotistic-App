-- 020_tochat_org_config.sql
-- Per-org white-label (tochat.be) integration state.
--
-- Two isolation modes, resolved in src/lib/tochat/org-config.ts:
--
--   isolated  — the org stored its own white-label account credentials
--               (email + password_encrypted). Every API call runs under
--               that account's JWT, so the upstream scopes reads/writes
--               to the org's own widgets. No tagging needed.
--
--   shared    — no per-org credentials; the deployment-wide master
--               account (TOCHAT_API_EMAIL / TOCHAT_API_PASSWORD) is
--               used and every query is filtered by the org's
--               `user_client` tag.
--
-- `user_client` is the tag applied to widgets created through the
-- WordPress connector ('cbc-{wp_user_id}') or this app ('org-{uuid}').
-- SSO-provisioned orgs inherit the WordPress tag so widgets created in
-- the member portal stay visible in the dashboard, and vice versa.

create table if not exists public.tochat_org_config (
  org_id uuid primary key
    references public.organizations (id) on delete cascade,
  user_client text not null default '',
  email text,
  password_encrypted text,
  api_base text,
  leads_api_key_encrypted text,
  connected_at timestamptz,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on column public.tochat_org_config.user_client is
  'userClient tag scoping this org inside the shared white-label account (cbc-{wpUserId} or org-{uuid}).';
comment on column public.tochat_org_config.password_encrypted is
  'AES-256-GCM ciphertext (src/lib/whatsapp/encryption.ts format).';
comment on column public.tochat_org_config.leads_api_key_encrypted is
  'Optional per-org leads API key (GET /api/get-json-lead).';

alter table public.tochat_org_config enable row level security;

drop policy if exists "tochat_org_config_org_scoped" on public.tochat_org_config;
create policy "tochat_org_config_org_scoped"
  on public.tochat_org_config
  for all
  using (org_id in (select public.user_org_ids()))
  with check (org_id in (select public.user_org_ids()));

-- Seed a tag row for every existing org (idempotent).
insert into public.tochat_org_config (org_id, user_client)
select id, 'org-' || id::text
from public.organizations
on conflict (org_id) do nothing;

-- Safety net for rows created before the default applied.
update public.tochat_org_config
set user_client = 'org-' || org_id::text
where user_client = '';
