import { NextRequest, NextResponse } from 'next/server';
import { getSoundCloudClient } from '@/lib/soundcloud/client';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: 'Query too short' }, { status: 400 });
  }

  // PERF: kick off the SoundCloud search and the Supabase auth check in
  // parallel. Auth is fast (cookie+JWT verify, sometimes a single round
  // trip); SoundCloud search dominates the latency. By starting them at
  // once we save ~50–200 ms vs the previous sequential version.
  const sc = getSoundCloudClient();

  const authPromise = (async () => {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user;
  })();

  const searchPromise = sc
    .searchTracks(query, { limit, offset })
    .catch((err) => {
      console.error('Search error:', err);
      return null;
    });

  const [user, tracks] = await Promise.all([authPromise, searchPromise]);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (tracks === null) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }

  return NextResponse.json({
    tracks,
    query,
    count: tracks.length,
  });
}
