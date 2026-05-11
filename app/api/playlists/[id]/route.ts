import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // PERF: fetch playlist + tracks in PARALLEL.
  // Was: sequential (~250-500ms total). Now: max(playlist, tracks) (~150-250ms).
  // RLS filters out playlists the user shouldn't see, so we don't need a
  // separate auth check here.
  const [playlistResult, tracksResult] = await Promise.all([
    supabase
      .from('playlists')
      .select(
        'id, user_id, name, short_code, slug, description, cover_url, ' +
        'is_public, stream_token, play_count, track_count, created_at, updated_at'
      )
      .eq('id', id)
      .single(),
    supabase
      .from('playlist_tracks')
      .select(
        'position, added_at, ' +
        'track:tracks (id, title, artist, duration_ms, artwork_url, permalink_url, genre)'
      )
      .eq('playlist_id', id)
      .order('position', { ascending: true }),
  ]);

  if (playlistResult.error || !playlistResult.data) {
    return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
  }
  if (tracksResult.error) {
    return NextResponse.json(
      { error: tracksResult.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      playlist: playlistResult.data,
      tracks:
        tracksResult.data?.map((t: any) => ({
          ...t.track,
          position: t.position,
          added_at: t.added_at,
        })) || [],
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    }
  );
}

/**
 * PATCH /api/playlists/[id]
 * Rename / change description / toggle visibility.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // PERF: parse body in parallel with auth.
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

  const updates: any = {};

  if (typeof body.name === 'string' && body.name.trim()) {
    updates.name = body.name.trim().substring(0, 100);
  }
  if (typeof body.description === 'string') {
    updates.description = body.description.trim() || null;
  }
  if (typeof body.is_public === 'boolean') {
    updates.is_public = body.is_public;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid updates' }, { status: 400 });
  }

  // RLS check + update in one query.
  const { data, error } = await supabase
    .from('playlists')
    .update(updates)
    .eq('id', id)
    .eq('user_id', session.user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ playlist: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
