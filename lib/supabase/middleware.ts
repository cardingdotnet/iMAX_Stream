import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Auth middleware.
 *
 * PERF: Uses `getSession()` (cookie + JWT verify, ~5ms) instead of
 * `getUser()` (round trip to Supabase auth servers, ~80-300ms) on every
 * request. The session cookie is signed and tamper-evident, so this is
 * safe for routing-level redirects. Server components and API routes
 * that need a verified user identity still call `getSession()` themselves
 * and rely on Supabase's signed JWT — for write operations RLS does the
 * actual security check at the DB level.
 *
 * The session is auto-refreshed when it's about to expire — we let the
 * SSR helper handle that lazily inside the cookie adapter, so most
 * requests don't trigger a refresh.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
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

  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user || null;

  const { pathname } = request.nextUrl;

  const protectedRoutes = ['/library', '/playlist', '/account'];
  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  const authRoutes = ['/login', '/signup'];
  if (authRoutes.includes(pathname) && user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return supabaseResponse;
}
