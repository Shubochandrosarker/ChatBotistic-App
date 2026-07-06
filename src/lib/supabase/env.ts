const REQUIRED_PUBLIC_SUPABASE_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const;

export type PublicSupabaseEnv = {
  url: string;
  anonKey: string;
};

function isMissing(value: string | undefined) {
  return !value || value.trim().length === 0;
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  const missing = REQUIRED_PUBLIC_SUPABASE_ENV.filter((key) =>
    isMissing(process.env[key])
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing Supabase environment variables: ${missing.join(
        ', '
      )}. Add them in the deployment provider from Supabase Project Settings > API, then redeploy.`
    );
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  };
}

export function getMissingPublicSupabaseEnv() {
  return REQUIRED_PUBLIC_SUPABASE_ENV.filter((key) =>
    isMissing(process.env[key])
  );
}
