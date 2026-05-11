import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminSupabaseClient } from '@/lib/supabase/server';
import { getSoundCloudClient } from '@/lib/soundcloud/client';

export const runtime = 'nodejs';

/**
 * POST /api/playlists/[id]/tracks
 * Body: { trackId: number } - SoundCloud track ID
 *
 * PERF: Was 5 sequential queries:
 *   1. auth.getUser (network)
 *   2. verify playlist ownership
 *   3. check track exists in tracks table
 *   4. (maybe) fetch from SoundCloud + insert track
 *   5. SELECT MAX(position)
 *   6. INSERT playlist_track
 *
 * Now:
 *   - Auth via cookie (no network).
 *   - Single RPC `add_track_to_playlist` does ownership check + position
 *     calc + insert atomically. Track caching is decoupled (only fires on
 *     cache miss).
 *   - Body parse runs in parallel with auth.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: playlistId } = await params;
  const supabase = await createClient();

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

  const trackId = Number(body.trackId);
  if (!trackId || isNaN(trackId)) {
    return NextResponse.json(
      { error: 'Valid trackId required' },
      { status: 400 }
    );
  }

  // PERF: kick off the SoundCloud track fetch optimistically and the cache
  // check in parallel. If the track is already cached we just discard the
  // SoundCloud fetch result (it gets cached in the in-process client cache
  // anyway, so it isn't wasted).
  const admin = createAdminSupabaseClient();
  const sc = getSoundCloudClient();

  const cachedPromise = admin
    .from('tracks')
    .select('id')
    .eq('id', trackId)
    .maybeSingle();

  // Don't actually fetch from SoundCloud unless needed.
  const cachedResult = await cachedPromise;

  if (!cachedResult.data) {
    // Track not cached → fetch from SoundCloud and cache it.
    const track = await sc.getTrack(trackId);

    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }
    if (!track.streamable) {
      return NextResponse.json(
        { error: 'Track is not streamable' },
        { status: 400 }
      );
    }

    const { error: insertError } = await admin.from('tracks').upsert(
      {
        id: track.id,
        title: track.title,
        artist: track.artist,
        duration_ms: track.duration,
        artwork_url: track.artworkUrl,
        permalink_url: track.permalinkUrl,
        soundcloud_user_id: track.artistId,
        streamable: track.streamable,
        genre: track.genre,
      },
      { onConflict: 'id' }
    );

    if (insertError) {
      console.error('Track cache error:', insertError);
      return NextResponse.json(
        { error: 'Failed to cache track' },
        { status: 500 }
      );
    }
  }

  // Atomic: ownership check + position calc + insert in ONE round trip.
  // See database/migration_perf.sql for the function definition.
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'add_track_to_playlist',
    {
      p_playlist_id: playlistId,
      p_track_id: trackId,
    }
  );

  if (rpcError) {
    const msg = rpcError.message || '';
    if (msg.includes('not_owner') || msg.includes('not_found')) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }
    if (msg.includes('duplicate') || msg.includes('already')) {
      return NextResponse.json(
        { error: 'Track already in playlist' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg || 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, position: rpcData },
    { status: 201 }
  );
}

/**
 * DELETE /api/playlists/[id]/tracks?trackId=123
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: playlistId } = await params;
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get('trackId');

  if (!trackId) {
    return NextResponse.json({ error: 'trackId required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // RLS protects against deleting from other people's playlists.
  const { error } = await supabase
    .from('playlist_tracks')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('track_id', trackId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
