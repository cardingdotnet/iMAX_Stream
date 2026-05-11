import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  createClient as createAdminClient,
  SupabaseClient,
} from '@supabase/supabase-js';

/**
 * Server-side Supabase client (uses user's session).
 * Use in: Server Components, Route Handlers.
 *
 * Must be created per-request because cookies are request-scoped.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component context — cookies are read-only
          }
        },
      },
      // PERF: skip URL detection on the server (we never have a URL there)
      auth: {
        detectSessionInUrl: false,
      },
    }
  );
}

/**
 * Admin client (uses service role key — bypasses RLS).
 * Use ONLY for: stream endpoint, admin operations.
 * NEVER expose to client.
 *
 * PERF: cached at module level. The admin client is stateless (no cookies,
 * no per-user session) so a single instance can be reused across the
 * entire process. Previously every request did a fresh
 * `@supabase/supabase-js` constructor which sets up auth listeners,
 * realtime channels, etc. — measurable overhead on cold paths.
 */
let _adminClient: SupabaseClient | null = null;

export function createAdminSupabaseClient(): SupabaseClient {
  if (_adminClient) return _adminClient;

  _adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      // Disable realtime — we never use it server-side; this avoids the
      // WebSocket setup cost.
      realtime: { params: { eventsPerSecond: 0 } as any },
      global: {
        headers: {
          'X-Client-Info': 'spotify-clone-server',
        },
      },
    }
  );

  return _adminClient;
}
