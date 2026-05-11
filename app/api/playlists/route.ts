import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { generateUniqueShortCode } from '@/lib/utils/slug';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();

  // PERF: getSession() reads the cookie and skips the network call to Supabase
  // auth servers — middleware has already validated the JWT.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // PERF: read denormalized track_count instead of expensive sub-select.
  const { data, error } = await supabase
    .from('playlists')
    .select(
      'id, name, short_code, slug, description, cover_url, is_public, ' +
      'stream_token, play_count, track_count, created_at, updated_at'
    )
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { playlists: data },
    {
      headers: {
        // Browser can use a fresh-ish cached copy briefly; revalidate in background.
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // PERF: parse body in parallel with auth check.
  const [{ data: { session } }, body] = await Promise.all([
    supabase.auth.getSession(),
    request.json().catch(() => null as any),
  ]);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, description, is_public } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json(
      { error: 'Playlist name is required' },
      { status: 400 }
    );
  }

  if (name.length > 100) {
    return NextResponse.json(
      { error: 'Playlist name too long (max 100 chars)' },
      { status: 400 }
    );
  }

  // Generate a unique short code (the helper retries until unique)
  const admin = createAdminSupabaseClient();
  const shortCode = await generateUniqueShortCode(async (candidate) => {
    const { data } = await admin
      .from('playlists')
      .select('id')
      .eq('short_code', candidate)
      .maybeSingle();
    return !!data;
  });

  const slug = name.trim().toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60) || 'playlist';

  const { data, error } = await supabase
    .from('playlists')
    .insert({
      user_id: session.user.id,
      name: name.trim(),
      short_code: shortCode,
      slug: `${slug}-${shortCode}`,
      description: description?.trim() || null,
      is_public: Boolean(is_public),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ playlist: data }, { status: 201 });
}
