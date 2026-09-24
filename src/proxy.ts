import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicSupabaseEnv, getMissingPublicSupabaseEnv } from './lib/supabase/env';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const missingSupabaseEnv = getMissingPublicSupabaseEnv();

  if (missingSupabaseEnv.length > 0) {
    const message = `Supabase is not configured. Problem with: ${missingSupabaseEnv.join(
      ', '
    )}. NEXT_PUBLIC_* values are baked into the app at build time — set the real values from Supabase Project Settings > API in the build environment, then rebuild and redeploy. Saving them in the hosting panel after the fact has no effect on an already-built app.`;

    const pathname = request.nextUrl.pathname;
    const publicWithoutAuth =
      pathname === '/' ||
      pathname === '/pricing' ||
      pathname === '/docs' ||
      pathname === '/robots.txt' ||
      pathname === '/sitemap.xml' ||
      pathname === '/llms.txt' ||
      pathname === '/llms-full.txt' ||
      pathname === '/manifest.webmanifest' ||
      pathname === '/icon' ||
      pathname === '/apple-icon' ||
      pathname.startsWith('/install-widget/') ||
      // Published chat landing pages (public by design; the page itself
      // only renders public widget fields and never reads a session).
      pathname.startsWith('/whatsapp-business-directory/') ||
      pathname.startsWith('/land/');

    // Public marketing, indexing, and widget-loader routes do not need a
    // Supabase session. Keeping them available makes SEO and widget installs
    // resilient while the operator is completing deployment configuration;
    // every API and protected dashboard route still fails closed below.
    if (publicWithoutAuth) return supabaseResponse;

    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: message }, { status: 503 });
    }

    return new NextResponse(message, {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getPublicSupabaseEnv();

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    user &&
    (request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/signup' ||
      request.nextUrl.pathname === '/forgot-password')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  const protectedPaths = [
    '/dashboard',
    '/inbox',
    '/contacts',
    '/pipelines',
    '/broadcasts',
    '/automations',
    '/settings',
    '/leads',
    '/knowledge-base',
    '/widgets',
    '/agents',
  ];
  if (
    !user &&
    protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (
    !user &&
    request.nextUrl.pathname.startsWith('/api/whatsapp/') &&
    !request.nextUrl.pathname.includes('/webhook')
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
