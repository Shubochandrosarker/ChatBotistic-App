// Shared request preamble for the /api/tochat/* proxy routes: auth →
// org → white-label scope. Returns a ready-to-send NextResponse on any
// failure (including the "not connected" `{ configured: false }` shape
// the UI renders as an empty state) so route handlers stay flat.

import { NextResponse } from 'next/server'
import { requireOrgId } from '@/lib/api/require-org-id'
import { resolveTochatScope } from '@/lib/tochat/org-config'
import type { TochatScope } from '@/lib/tochat/client'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function requireTochatScope(): Promise<
  | { orgId: string; supabase: SupabaseClient; scope: TochatScope; error: null }
  | { orgId: null; supabase: null; scope: null; error: NextResponse }
> {
  const { orgId, supabase, error } = await requireOrgId()
  if (error) return { orgId: null, supabase: null, scope: null, error }

  const scope = await resolveTochatScope(supabase, orgId)
  if (!scope) {
    // Neither the org's own account nor the deployment master account
    // is available — the UI shows the "connect your account" state.
    return {
      orgId: null,
      supabase: null,
      scope: null,
      error: NextResponse.json({ configured: false }, { status: 200 }),
    }
  }

  return { orgId, supabase, scope, error: null }
}
