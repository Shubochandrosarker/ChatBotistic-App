import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton instance — one client shared across the whole browser session.
// Creating multiple clients causes auth-lock contention ("Lock was released
// because another request stole it") and intermittent fetch failures.
let browserClient: SupabaseClient | undefined

export function createClient() {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Build-time SSR prerender of client routes may execute this module in
  // an environment where NEXT_PUBLIC_* vars are not injected yet. Use a
  // harmless placeholder there so deploy builds can complete; browser
  // runtime still requires real env values.
  if (!url || !key) {
    if (typeof window !== 'undefined') {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
      )
    }
    browserClient = createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-anon-key'
    )
    return browserClient
  }

  browserClient = createBrowserClient(url, key)

  return browserClient
}
