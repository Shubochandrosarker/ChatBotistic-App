// NEXT_PUBLIC_* variables are inlined by Next.js at `next build` time via
// static text substitution of the exact `process.env.NEXT_PUBLIC_X`
// expression — in every bundle (browser, server, middleware) alike. That
// means a value set later in a hosting panel has NO effect on an
// already-built app; only a rebuild picks up a new value. Every read below
// uses that same static form so this module's diagnostics are guaranteed
// to see whatever was actually baked into this build — not whatever the
// live server process happens to have right now, which can silently
// disagree with it (see getMissingPublicSupabaseEnv below).
// Trimmed defensively: a stray leading/trailing space or newline from
// copy-pasting into a hosting panel or GitHub secret is a real, easy way
// for a "correct-looking" value to fail Supabase's exact-match apikey
// check while still passing an eyeball comparison.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

// Values that mean "not really configured" even though they're non-empty
// strings: the CI workflow's build-verification-only dummies (ci.yml never
// deploys, but a build run with its env by accident would otherwise look
// fully configured) and this codebase's own SSR/prerender fallback
// (src/lib/supabase/client.ts). If a build ships with any of these baked
// in, every sign-in fails with Supabase's bare "Invalid API key" — this
// list lets that be caught as a clear configuration error instead.
const PLACEHOLDER_URLS = new Set([
  'https://ci.example.supabase.co',
  'https://placeholder.supabase.co',
]);
const PLACEHOLDER_ANON_KEYS = new Set(['ci-dummy-anon-key', 'placeholder-anon-key']);

export type PublicSupabaseEnv = {
  url: string;
  anonKey: string;
};

function isMissing(value: string | undefined) {
  return !value || value.trim().length === 0;
}

function isPlaceholder(value: string | undefined, known: Set<string>) {
  return value !== undefined && known.has(value.trim());
}

/**
 * Every configuration problem with the two NEXT_PUBLIC_SUPABASE_* values
 * as they were baked into this specific build. Empty list means this
 * build has real-looking Supabase config (this cannot prove the values
 * are still *valid* against a live Supabase project — only that they're
 * present and not a known placeholder).
 */
export function getSupabaseConfigProblems(): string[] {
  const problems: string[] = [];

  if (isMissing(SUPABASE_URL)) {
    problems.push('NEXT_PUBLIC_SUPABASE_URL is missing');
  } else if (isPlaceholder(SUPABASE_URL, PLACEHOLDER_URLS)) {
    problems.push(
      'NEXT_PUBLIC_SUPABASE_URL is a placeholder value — this build was compiled without a real Supabase project configured'
    );
  }

  if (isMissing(SUPABASE_ANON_KEY)) {
    problems.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
  } else if (isPlaceholder(SUPABASE_ANON_KEY, PLACEHOLDER_ANON_KEYS)) {
    problems.push(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY is a placeholder value — this build was compiled without a real Supabase project configured'
    );
  }

  return problems;
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  const problems = getSupabaseConfigProblems();

  if (problems.length > 0) {
    throw new Error(
      `Supabase is not configured correctly: ${problems.join('; ')}. Set the real values from Supabase Project Settings > API in your build environment, then rebuild and redeploy — NEXT_PUBLIC_* values are baked in at build time, so changing them in the hosting panel alone has no effect on an already-built app.`
    );
  }

  return {
    url: SUPABASE_URL as string,
    anonKey: SUPABASE_ANON_KEY as string,
  };
}

/**
 * Back-compat wrapper: the two names of the two vars with a problem
 * (missing OR placeholder), for callers that only want the var names
 * rather than full sentences (src/proxy.ts builds its own message).
 */
export function getMissingPublicSupabaseEnv(): string[] {
  const missing: string[] = [];
  if (isMissing(SUPABASE_URL) || isPlaceholder(SUPABASE_URL, PLACEHOLDER_URLS)) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (
    isMissing(SUPABASE_ANON_KEY) ||
    isPlaceholder(SUPABASE_ANON_KEY, PLACEHOLDER_ANON_KEYS)
  ) {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return missing;
}
