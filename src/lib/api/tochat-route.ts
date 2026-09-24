// Shared request preamble for the /api/tochat/* proxy routes: auth →
// org → white-label scope. Returns a ready-to-send NextResponse on any
// failure so route handlers stay flat.
//
// Unconfigured handling is deliberately split:
//
//   GET/list routes call it plainly — the `{ configured: false }`
//   body with HTTP 200 is a *state* the UI renders as the "connect
//   your account" empty state, not an error.
//
//   Action routes (POST/PUT/DELETE, the FAQ scan) pass
//   `{ action: true }` — there the unconfigured state must surface as
//   a real HTTP error. Returning 200 for "nothing happened" made the
//   FAQ screen toast "0 FAQs generated" on success semantics.

import { NextResponse } from 'next/server'
import { requireOrgId } from '@/lib/api/require-org-id'
import { resolveTochatScope } from '@/lib/tochat/org-config'
import type { TochatScope } from '@/lib/tochat/client'
import type { SupabaseClient } from '@supabase/supabase-js'

export const NOT_CONNECTED_ERROR =
  'Your Chatbotistic messaging account is not connected yet. Connect it in Settings → Chatbotistic, then try again.'

export async function requireTochatScope(options?: {
  action?: boolean
}): Promise<
  | { orgId: string; supabase: SupabaseClient; scope: TochatScope; error: null }
  | { orgId: null; supabase: null; scope: null; error: NextResponse }
> {
  const { orgId, supabase, error } = await requireOrgId()
  if (error) return { orgId: null, supabase: null, scope: null, error }

  const scope = await resolveTochatScope(supabase, orgId)
  if (!scope) {
    // Neither the org's own account nor the deployment master account
    // is available. List callers render the "connect your account"
    // empty state from the 200 shape; action callers need the failure
    // to be unmistakable so the UI can't mistake it for success.
    return {
      orgId: null,
      supabase: null,
      scope: null,
      error: NextResponse.json(
        options?.action
          ? { configured: false, error: NOT_CONNECTED_ERROR }
          : { configured: false },
        { status: options?.action ? 409 : 200 },
      ),
    }
  }

  return { orgId, supabase, scope, error: null }
}
