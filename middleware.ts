import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Skip auth check on:
     * - Next.js internals (_next/static, _next/image, _next/data)
     * - Static assets (favicon, fonts, images, manifest)
     * - Public stream/radio endpoints (no auth needed)
     * - API auth routes (handle their own auth)
     */
    '/((?!_next/|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|stream/|api/stream/|api/stream-resolve/|radio/|api/radio/|api/auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|css|js|map)$).*)',
  ],
};
