import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: playlists } = await supabase
    .from('playlists')
    .select('id, name, cover_url, play_count, short_code, created_at, track_count')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false });

  return (
    <div className="px-6 sm:px-12 lg:px-16 py-12 sm:py-16 animate-fade-in">
      {/* Masthead */}
      <div className="mb-12 sm:mb-16 animate-fade-in-up">
        <p className="eyebrow text-cream-500 mb-3">Your Collection</p>
        <h1 className="font-serif text-display-sm sm:text-display text-cream-50 tracking-tight leading-[0.95]">
          Library
        </h1>
        <div className="flex items-center gap-3 mt-6">
          <p className="text-sm text-cream-300 tracking-tight">
            {playlists?.length || 0}{' '}
            <span className="text-cream-500">
              {playlists?.length === 1 ? 'playlist' : 'playlists'}
            </span>
          </p>
        </div>
        <div className="rule mt-8" />
      </div>

      {!playlists || playlists.length === 0 ? (
        <EmptyState
          illustration="cassette"
          eyebrow="Nothing here yet"
          title={'Create your first playlist.'}
          body="Use the + in the sidebar, then start adding tracks from search."
          action={{ label: 'Browse music', href: '/search' }}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {playlists.map((playlist, idx) => {
            const trackCount = (playlist as any).track_count || 0;
            const h1 = (playlist.id.charCodeAt(0) * 13) % 360;
            const h2 = (h1 + 35) % 360;

            return (
              <Link
                key={playlist.id}
                href={`/playlist/${playlist.id}`}
                prefetch
                className="group block animate-fade-in-up"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="aspect-square mb-3 overflow-hidden relative rounded-md cover-placeholder shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] group-hover:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)] transition-shadow duration-500">
                  {playlist.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={playlist.cover_url}
                      alt={playlist.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{
                        background: `
                          radial-gradient(circle at 30% 25%, hsla(${h1}, 60%, 35%, 0.85), transparent 55%),
                          radial-gradient(circle at 75% 75%, hsla(${h2}, 50%, 25%, 0.9), transparent 60%),
                          #1A1A20
                        `,
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                <h3 className="font-serif text-base text-cream-50 leading-tight tracking-tight truncate group-hover:text-coral-500 transition-colors">
                  {playlist.name}
                </h3>
                <p className="text-xs text-cream-500 mt-1 tracking-tight">
                  {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
                  {playlist.play_count > 0 && ` · ${playlist.play_count} plays`}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
