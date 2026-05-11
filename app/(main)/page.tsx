import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ArrowUpRight, Search, Library, Share2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const userId = session.user.id;
  const [profileResult, playlistsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', userId)
      .single(),
    supabase
      .from('playlists')
      .select('id, name, cover_url, play_count, short_code, track_count')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(8),
  ]);

  const profile = profileResult.data;
  const playlists = playlistsResult.data ?? [];
  const greeting = getGreeting();
  const name = profile?.display_name || profile?.username || 'there';
  const totalPlays = playlists.reduce((acc, p) => acc + (p.play_count || 0), 0);
  const totalTracks = playlists.reduce((acc, p: any) => acc + (p.track_count || 0), 0);

  return (
    <div className="min-h-full">
      {/* ─────────── HERO ─────────── */}
      <section className="relative grain hero-gradient">
        <div className="relative z-10 px-6 sm:px-12 lg:px-16 pt-16 sm:pt-24 pb-20 sm:pb-32">
          <p className="eyebrow text-coral-500 mb-6 animate-fade-in">
            {greeting}
          </p>
          <h1 className="font-serif text-display-sm sm:text-display lg:text-display-lg text-cream-50 leading-[0.95] tracking-tight max-w-3xl text-balance animate-fade-in-up">
            Welcome back,
            <br />
            <span className="italic font-light">{name}</span>.
          </h1>

          {playlists.length > 0 ? (
            <div className="flex flex-wrap items-end gap-x-12 gap-y-4 mt-12 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
              <Stat label="Playlists" value={playlists.length.toString()} />
              <Stat label="Tracks" value={totalTracks.toString()} />
              <Stat label="Total plays" value={totalPlays.toString()} />
            </div>
          ) : (
            <p className="mt-8 max-w-xl text-cream-300 text-lg leading-relaxed animate-fade-in-up" style={{ animationDelay: '120ms' }}>
              Build a playlist, then send it anywhere — your IMVU room, VLC, a shared link.
              One URL, every player.
            </p>
          )}

          {/* Quick actions */}
          <div className="flex flex-wrap gap-3 mt-10 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <Link href="/search" prefetch className="btn-accent">
              Discover music
              <ArrowUpRight className="w-4 h-4" strokeWidth={2} />
            </Link>
            <Link href="/library" prefetch className="btn-secondary">
              Open library
            </Link>
          </div>
        </div>

        {/* Decorative editorial element bottom right */}
        <div className="hidden md:block absolute bottom-8 right-12 z-10 text-right pointer-events-none select-none">
          <p className="font-serif italic text-cream-500 text-sm leading-snug">
            <span className="block">EgMax — </span>
            <span className="block">music, beautifully streamed.</span>
          </p>
        </div>
      </section>

      {/* ─────────── PLAYLISTS GRID or empty state ─────────── */}
      <section className="px-6 sm:px-12 lg:px-16 py-12 sm:py-16">
        {playlists.length > 0 ? (
          <>
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="eyebrow text-cream-500 mb-2">Recently updated</p>
                <h2 className="font-serif text-3xl sm:text-4xl text-cream-50 tracking-tight">
                  Your playlists
                </h2>
              </div>
              <Link
                href="/library"
                prefetch
                className="text-sm text-cream-300 hover:text-cream-50 tracking-tight inline-flex items-center gap-1 transition-colors"
              >
                View all
                <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {playlists.map((p, idx) => (
                <PlaylistCard key={p.id} playlist={p as any} idx={idx} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            illustration="crate"
            eyebrow="Empty library"
            title={'Start your collection.'}
            body="Search SoundCloud, save what moves you, share a single URL with anyone."
            action={{ label: 'Start exploring', href: '/search' }}
          />
        )}
      </section>

      {/* ─────────── FEATURE STRIP ─────────── */}
      {playlists.length > 0 && (
        <section className="px-6 sm:px-12 lg:px-16 pb-20">
          <div className="rule mb-12" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-8">
            <FeatureItem
              icon={<Search className="w-5 h-5" strokeWidth={1.5} />}
              eyebrow="01 — Discover"
              title="A library that listens"
              body="Search across SoundCloud's catalog. Save what you like."
            />
            <FeatureItem
              icon={<Library className="w-5 h-5" strokeWidth={1.5} />}
              eyebrow="02 — Curate"
              title="Playlists, your way"
              body="Order, rename, share. No algorithm telling you what to play."
            />
            <FeatureItem
              icon={<Share2 className="w-5 h-5" strokeWidth={1.5} />}
              eyebrow="03 — Stream"
              title="One URL, every player"
              body="IMVU rooms, VLC, browsers, mobile. Your stream travels with you."
            />
          </div>
        </section>
      )}
    </div>
  );
}

/* ────────── pieces ────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-serif text-4xl sm:text-5xl text-cream-50 leading-none tracking-tight">
        {value}
      </p>
      <p className="eyebrow text-cream-500 mt-2">{label}</p>
    </div>
  );
}

function FeatureItem({
  icon,
  eyebrow,
  title,
  body,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="text-coral-500 mb-4">{icon}</div>
      <p className="eyebrow text-cream-500 mb-2">{eyebrow}</p>
      <h3 className="font-serif text-xl text-cream-50 tracking-tight mb-2">{title}</h3>
      <p className="text-sm text-cream-300 leading-relaxed">{body}</p>
    </div>
  );
}

function PlaylistCard({
  playlist,
  idx,
}: {
  playlist: { id: string; name: string; cover_url: string | null; play_count: number; track_count?: number };
  idx: number;
}) {
  const trackCount = playlist.track_count || 0;
  return (
    <Link
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
          <CoverFallback seed={playlist.id} />
        )}

        {/* Subtle dark overlay on hover */}
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
}

function CoverFallback({ seed }: { seed: string }) {
  // Deterministic but varied — uses 2 hue stops based on seed
  const h1 = (seed.charCodeAt(0) * 13) % 360;
  const h2 = (h1 + 35) % 360;
  return (
    <div
      className="w-full h-full"
      style={{
        background: `
          radial-gradient(circle at 30% 25%, hsla(${h1}, 60%, 35%, 0.85), transparent 55%),
          radial-gradient(circle at 75% 75%, hsla(${h2}, 50%, 25%, 0.9), transparent 60%),
          #1A1A20
        `,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full opacity-30"
        preserveAspectRatio="none"
      >
        <path
          d="M 0 60 Q 25 50, 50 60 T 100 55 L 100 100 L 0 100 Z"
          fill="rgba(255,255,255,0.07)"
        />
      </svg>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5)  return 'Late hours';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Tonight';
}
