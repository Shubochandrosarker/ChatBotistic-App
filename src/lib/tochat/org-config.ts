// DB-backed resolution of how one org talks to the white-label API.
//
// Resolution order (src/lib/tochat/client.ts defines the shapes):
//   1. The org's own connected account (tochat_org_config.email +
//      password_encrypted) → `isolated` scope. Only the org's own
//      widgets/agents/FAQs/bookings are reachable — enforced upstream
//      by that account's JWT, not by our filtering.
//   2. The deployment-wide master account (TOCHAT_API_EMAIL /
//      TOCHAT_API_PASSWORD env) → `shared` scope. Every query must be
//      tagged with the org's `user_client`.
//   3. Neither → null (integration "not connected" for this org).
//
// Server-only: reads encrypted secrets and must never run in the browser.

import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt, encrypt } from '@/lib/whatsapp/encryption'
import { normalizeTochatBase, type TochatScope } from './client'

export interface OrgTochatStatus {
  user_client: string
  email: string | null
  api_base: string | null
  connected_at: string | null
  verified_at: string | null
}

interface OrgConfigRow {
  user_client: string | null
  email: string | null
  password_encrypted: string | null
  api_base: string | null
  leads_api_key_encrypted: string | null
  connected_at: string | null
  verified_at: string | null
}

async function loadRow(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OrgConfigRow | null> {
  const { data, error } = await supabase
    .from('tochat_org_config')
    .select('user_client, email, password_encrypted, api_base, leads_api_key_encrypted, connected_at, verified_at')
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to load white-label config: ${error.message}`)
  }
  return (data as OrgConfigRow | null) ?? null
}

/**
 * The org's userClient tag. Falls back to the deterministic `org-{id}`
 * default when no row exists yet (e.g. orgs created before migration
 * 020, or between signup and first SSO provision).
 */
export async function tochatTagForOrg(supabase: SupabaseClient, orgId: string): Promise<string> {
  const row = await loadRow(supabase, orgId)
  return row?.user_client || `org-${orgId}`
}

/** Resolve how this org authenticates against the white-label API. */
export async function resolveTochatScope(
  supabase: SupabaseClient,
  orgId: string,
): Promise<TochatScope | null> {
  const row = await loadRow(supabase, orgId)

  if (row?.email && row.password_encrypted) {
    try {
      const password = decrypt(row.password_encrypted)
      return {
        orgId,
        mode: 'isolated',
        email: row.email,
        password,
        base: normalizeTochatBase(row.api_base || process.env.TOCHAT_API_BASE),
        userClient: null,
      }
    } catch (err) {
      // Corrupted ciphertext (e.g. ENCRYPTION_KEY rotation) — treat the
      // org as not connected rather than silently falling back to the
      // master account, which would show them someone else's data.
      console.error(
        `[tochat] org ${orgId}: stored credentials failed to decrypt — needs reconnect`,
        err instanceof Error ? err.message : err,
      )
      return null
    }
  }

  const masterEmail = process.env.TOCHAT_API_EMAIL
  const masterPassword = process.env.TOCHAT_API_PASSWORD
  if (masterEmail && masterPassword) {
    return {
      orgId,
      mode: 'shared',
      email: masterEmail,
      password: masterPassword,
      base: normalizeTochatBase(process.env.TOCHAT_API_BASE),
      userClient: row?.user_client || `org-${orgId}`,
    }
  }

  return null
}

/** Status payload for the settings UI (never includes secrets). */
export async function tochatStatusForOrg(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OrgTochatStatus> {
  const row = await loadRow(supabase, orgId)
  return {
    user_client: row?.user_client || `org-${orgId}`,
    email: row?.email ?? null,
    api_base: row?.api_base ?? null,
    connected_at: row?.connected_at ?? null,
    verified_at: row?.verified_at ?? null,
  }
}

/**
 * Store (or replace) the org's own white-label account credentials.
 * Callers MUST have verified the pair with verifyTochatLogin() first.
 * Keeps the existing user_client tag untouched — disconnecting and
 * reconnecting an account never re-keys tenancy.
 */
export async function connectOrgAccount(
  supabase: SupabaseClient,
  orgId: string,
  email: string,
  password: string,
  apiBase: string | null,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase.from('tochat_org_config').upsert(
    {
      org_id: orgId,
      email,
      password_encrypted: encrypt(password),
      api_base: apiBase || null,
      connected_at: now,
      verified_at: now,
      updated_at: now,
    },
    { onConflict: 'org_id' },
  )
  if (error) {
    throw new Error(`Failed to save the white-label account: ${error.message}`)
  }
}

/** Forget the org's connected account (keeps the tenancy tag). */
export async function disconnectOrgAccount(
  supabase: SupabaseClient,
  orgId: string,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('tochat_org_config')
    .update({
      email: null,
      password_encrypted: null,
      api_base: null,
      connected_at: null,
      verified_at: null,
      updated_at: now,
    })
    .eq('org_id', orgId)
  if (error) {
    throw new Error(`Failed to disconnect the white-label account: ${error.message}`)
  }
}

/**
 * Seed the tenancy tag for a newly provisioned org. SSO subjects look
 * like `wp-{id}` — those orgs inherit the WordPress connector's
 * `cbc-{id}` tag so widgets created in the member portal are visible
 * here. Never overwrites an existing tag.
 */
export async function seedTagForOrg(
  supabase: SupabaseClient,
  orgId: string,
  ssoSubject: string,
): Promise<void> {
  const wpMatch = /^wp-(.+)$/.exec(ssoSubject)
  const tag = wpMatch ? `cbc-${wpMatch[1]}` : `org-${orgId}`
  const { error } = await supabase.from('tochat_org_config').upsert(
    { org_id: orgId, user_client: tag },
    { onConflict: 'org_id', ignoreDuplicates: true },
  )
  if (error) {
    throw new Error(`Failed to seed white-label tenancy tag: ${error.message}`)
  }
}

/**
 * Optional per-org leads API key (GET /api/get-json-lead). Null when
 * the org hasn't set one — callers then fall back to the deployment's
 * CHATBOTISTIC_API_KEY.
 */
export async function orgLeadsApiKey(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ key: string; baseUrl: string | null } | null> {
  const row = await loadRow(supabase, orgId)
  if (!row?.leads_api_key_encrypted) return null
  try {
    return { key: decrypt(row.leads_api_key_encrypted), baseUrl: row.api_base }
  } catch {
    console.error(`[tochat] org ${orgId}: stored leads key failed to decrypt`)
    return null
  }
}

export async function saveOrgLeadsApiKey(
  supabase: SupabaseClient,
  orgId: string,
  key: string | null,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('tochat_org_config')
    .update({
      leads_api_key_encrypted: key ? encrypt(key) : null,
      updated_at: now,
    })
    .eq('org_id', orgId)
  if (error) {
    throw new Error(`Failed to save the leads API key: ${error.message}`)
  }
}
