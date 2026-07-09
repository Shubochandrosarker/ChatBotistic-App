import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseConfigProblems } from './env'

// Singleton instance — one client shared across the whole browser session.
// Creating multiple clients causes auth-lock contention ("Lock was released
// because another request stole it") and intermittent fetch failures.
let browserClient: SupabaseClient | undefined

export function createClient() {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  // Build-time SSR prerender of client routes may execute this module in
  // an environment where NEXT_PUBLIC_* vars are not injected yet. Use a
  // harmless placeholder there so deploy builds can complete; browser
  // runtime still requires real, non-placeholder env values (checked via
  // the same source of truth src/proxy.ts uses, so both agree on what
  // counts as "configured").
  if (getSupabaseConfigProblems().length > 0) {
    if (typeof window !== 'undefined') {
      throw new Error(
        'Missing or invalid NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY for this build'
      )
    }
    browserClient = createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-anon-key'
    )
    return browserClient
  }

  browserClient = createBrowserClient(url as string, key as string)

  return browserClient
}
