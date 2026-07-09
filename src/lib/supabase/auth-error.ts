/**
 * Supabase's GoTrue server returns the bare string "Invalid API key"
 * whenever the request's `apikey` header doesn't match a real project —
 * including when NEXT_PUBLIC_SUPABASE_ANON_KEY was missing, a placeholder,
 * or simply stale/wrong at build time (see src/lib/supabase/env.ts). That
 * is a deployment configuration problem, not something the person signing
 * in can do anything about, so surface it as one instead of parroting the
 * cryptic raw string.
 */
export function describeAuthError(message: string): string {
  if (/invalid api key/i.test(message)) {
    return "This deployment isn't connected to Supabase correctly. If you're the site operator: rebuild with the correct NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (Supabase Project Settings > API) and redeploy — these values are baked in at build time, so updating them in the hosting panel alone won't fix an already-built app.";
  }
  return message;
}
