'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search as SearchIcon, Plus, Loader2, Music, Play, Pause, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDuration } from '@/lib/utils';
import { usePlayerStore, PlayerTrack } from '@/lib/player/store';
import type { Track } from '@/lib/soundcloud/types';
import { TrackListSkeleton } from '@/components/ui/Skeletons';
import AudioWaves from '@/components/ui/AudioWaves';

interface Playlist {
  id: string;
  name: string;
}

const SUGGESTIONS = [
  'lofi beats', 'arabic music', 'workout', 'chill', 
  'jazz', 'house', 'techno', 'rap', 'rock', 'classical'
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState<number | null>(null);
  
  const { 
    currentTrack, isPlaying, togglePlay, playQueue 
  } = usePlayerStore();

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    // PERF: 250ms feels snappy without thrashing the SC API.
    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    fetch('/api/playlists')
      .then(r => r.json())
      .then(data => setPlaylists(data.playlists || []))
      .catch(console.error);
  }, []);

  // Tiny in-component cache keyed by query → results.
  // Avoids re-hitting the API when the user types, deletes, then retypes.
  const searchCacheRef = useRef(new Map<string, Track[]>());
  // Abort controller for the in-flight search so older queries don't
  // overwrite newer results out of order.
  const inFlightRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (q: string) => {
    const cached = searchCacheRef.current.get(q.trim().toLowerCase());
    if (cached) {
      setResults(cached);
      return;
    }

    // Cancel previous request — old results landing late would clobber newer.
    if (inFlightRef.current) {
      inFlightRef.current.abort();
    }
    const ctrl = new AbortController();
    inFlightRef.current = ctrl;

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal: ctrl.signal,
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Search failed');
        return;
      }

      // Cache up to 30 query results (LRU-ish).
      const cache = searchCacheRef.current;
      if (cache.size >= 30) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) cache.delete(firstKey);
      }
      cache.set(q.trim().toLowerCase(), data.tracks);

      setResults(data.tracks);
    } catch (err: any) {
      if (err?.name === 'AbortError') return; // Superseded by newer query
      toast.error('Network error');
    } finally {
      // Only clear loading if this is still the latest request.
      if (inFlightRef.current === ctrl) setLoading(false);
    }
  }, []);

  function handlePlay(track: Track, index: number) {
    if (currentTrack?.id === track.id) {
      togglePlay();
      return;
    }
    
    const queue: PlayerTrack[] = results.map(t => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      duration: t.duration,
      artworkUrl: t.artworkUrl,
    }));
    
    playQueue(queue, index);
  }

  async function addToPlaylist(track: Track, playlistId: string) {
    setShowPlaylistMenu(null);

    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          toast.error('Already in this playlist');
        } else {
          toast.error(data.error || 'Failed to add');
        }
        return;
      }

      toast.success(`Added to playlist`);
    } catch (err) {
      toast.error('Network error');
    }
  }

  return (
    <div className="px-6 sm:px-12 lg:px-16 py-12 sm:py-16">
      {/* Masthead */}
      <div className="mb-8 animate-fade-in-up">
        <p className="eyebrow text-cream-500 mb-3">Discover</p>
        <h1 className="font-serif text-display-sm sm:text-display text-cream-50 tracking-tight leading-[0.95] mb-8">
          Search.
        </h1>

        {/* Search Bar */}
        <div className="relative max-w-2xl">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <SearchIcon
              className={`w-4 h-4 transition-colors ${
                query ? 'text-coral-500' : 'text-cream-500'
              }`}
              strokeWidth={1.75}
            />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Songs, artists, genres…"
            className="input pl-11 pr-11 text-base py-3.5 rounded-md font-serif italic placeholder:not-italic placeholder:font-sans"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/[0.05] rounded-md transition-colors"
            >
              <X className="w-4 h-4 text-cream-300" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {/* Initial state — Suggestions */}
      {!loading && query.length < 2 && (
        <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="rule mb-8" />
          <p className="eyebrow text-cream-500 mb-4">Try searching</p>

          <div className="flex flex-wrap gap-2 mb-16 max-w-2xl">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="px-3.5 py-1.5 bg-transparent hover:bg-white/[0.04] rounded-full text-sm border border-[var(--line-soft)] hover:border-[var(--line-strong)] transition-colors text-cream-200 hover:text-cream-50 tracking-tight font-serif italic animate-fade-in-up"
                style={{ animationDelay: `${150 + idx * 30}ms` }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Browse genres — quieter, editorial */}
          <div>
            <p className="eyebrow text-cream-500 mb-4">Browse all</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {[
                { name: 'Lofi',       hue: 280 },
                { name: 'Ambient',    hue: 200 },
                { name: 'House',      hue: 25  },
                { name: 'Hip Hop',    hue: 45  },
                { name: 'Jazz',       hue: 320 },
                { name: 'Classical',  hue: 160 },
                { name: 'Indie',      hue: 130 },
                { name: 'Electronic', hue: 220 },
                { name: 'Arabic',     hue: 5   },
                { name: 'Soul',       hue: 350 },
              ].map((g, idx) => (
                <button
                  key={g.name}
                  onClick={() => setQuery(g.name.toLowerCase())}
                  className="aspect-[4/3] rounded-md p-4 relative overflow-hidden text-left hover-lift cursor-pointer animate-fade-in-up cover-placeholder transition-all"
                  style={{
                    animationDelay: `${300 + idx * 30}ms`,
                    background: `
                      radial-gradient(circle at 30% 25%, hsla(${g.hue}, 55%, 30%, 0.85), transparent 55%),
                      radial-gradient(circle at 75% 75%, hsla(${(g.hue + 35) % 360}, 50%, 22%, 0.9), transparent 60%),
                      #1A1A20
                    `,
                  }}
                >
                  <h3 className="font-serif text-lg sm:text-xl text-cream-50 tracking-tight">
                    {g.name}
                  </h3>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="animate-fade-in">
          <TrackListSkeleton count={8} />
        </div>
      )}

      {/* No results */}
      {!loading && query.length >= 2 && results.length === 0 && (
        <div className="py-16 animate-fade-in max-w-md mx-auto text-center">
          <p className="eyebrow text-cream-500 mb-4">No matches</p>
          <h3 className="font-serif text-2xl text-cream-50 tracking-tight mb-2">
            Nothing found.
          </h3>
          <p className="text-cream-300 text-sm">
            Try a different keyword or one of the suggestions above.
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="animate-fade-in">
          <div className="rule mb-6" />
          <p className="text-sm text-cream-300 mb-4 tracking-tight">
            <span className="font-medium text-cream-50">{results.length}</span>{' '}
            <span className="text-cream-500">
              {results.length === 1 ? 'result for' : 'results for'} &ldquo;{query}&rdquo;
            </span>
          </p>
          
          <div className="space-y-0.5">
            {results.map((track, idx) => {
              const isCurrentTrack = currentTrack?.id === track.id;
              const showPause = isCurrentTrack && isPlaying;

              return (
                <div
                  key={track.id}
                  className={`
                    flex items-center gap-3 sm:gap-4 px-2 sm:px-3 py-2 rounded-md group
                    transition-colors
                    ${isCurrentTrack ? 'bg-white/[0.04]' : 'hover:bg-white/[0.03]'}
                  `}
                  style={{
                    animation: 'fadeInUp 0.3s ease-out backwards',
                    animationDelay: `${idx * 25}ms`,
                  }}
                >
                  {/* Artwork with overlay play button */}
                  <button
                    onClick={() => handlePlay(track, idx)}
                    className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-sm overflow-hidden cover-placeholder flex-shrink-0 group/art"
                  >
                    {track.artworkUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={track.artworkUrl}
                        alt={track.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-5 h-5 text-cream-300/50" strokeWidth={1.25} />
                      </div>
                    )}

                    {/* Hover overlay (desktop) */}
                    <div className="hidden sm:flex absolute inset-0 bg-ink-900/70 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {showPause ? (
                        <Pause className="w-5 h-5 text-cream-50" fill="currentColor" />
                      ) : (
                        <Play className="w-5 h-5 text-cream-50 ml-0.5" fill="currentColor" />
                      )}
                    </div>

                    {/* Mobile tap overlay */}
                    <div className="sm:hidden absolute inset-0 bg-ink-900/40 flex items-center justify-center opacity-0 active:opacity-100 transition-opacity">
                      {showPause ? (
                        <Pause className="w-5 h-5 text-cream-50" fill="currentColor" />
                      ) : (
                        <Play className="w-5 h-5 text-cream-50 ml-0.5" fill="currentColor" />
                      )}
                    </div>

                    {/* Now playing indicator */}
                    {isCurrentTrack && isPlaying && (
                      <div className="absolute inset-0 bg-ink-900/70 flex items-center justify-center">
                        <AudioWaves size="md" />
                      </div>
                    )}
                  </button>

                  {/* Title + Artist */}
                  <button
                    onClick={() => handlePlay(track, idx)}
                    className="min-w-0 text-left flex-1"
                  >
                    <p className={`font-medium truncate text-sm tracking-tight transition-colors ${
                      isCurrentTrack ? 'text-coral-500' : 'text-cream-50'
                    }`}>
                      {track.title}
                    </p>
                    <p className="text-xs text-cream-300 truncate mt-0.5">
                      {track.artist}
                    </p>
                  </button>

                  {/* Duration (desktop) */}
                  <span className="hidden sm:inline text-xs text-cream-500 font-mono tabular-nums">
                    {formatDuration(track.duration)}
                  </span>

                  {/* Add to playlist */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setShowPlaylistMenu(
                        showPlaylistMenu === track.id ? null : track.id
                      )}
                      className="p-2 hover:bg-white/[0.06] rounded-md transition-colors text-cream-300 hover:text-cream-50"
                      title="Add to playlist"
                    >
                      <Plus className="w-4 h-4" strokeWidth={1.75} />
                    </button>

                    {showPlaylistMenu === track.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowPlaylistMenu(null)}
                        />
                        <div className="absolute right-0 mt-2 w-56 bg-ink-800 border border-[var(--line-soft)] rounded-lg shadow-2xl z-50 max-h-72 overflow-y-auto animate-scale-in">
                          <p className="px-4 py-3 eyebrow text-cream-500 border-b border-[var(--line-soft)]">
                            Add to playlist
                          </p>
                          {playlists.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-cream-300 text-center font-serif italic">
                              No playlists yet
                            </div>
                          ) : (
                            <div className="p-1">
                              {playlists.map((p) => (
                                <button
                                  key={p.id}
                                  onClick={() => addToPlaylist(track, p.id)}
                                  className="w-full text-left px-3 py-2 hover:bg-white/[0.04] transition-colors text-sm truncate rounded-md text-cream-200 hover:text-cream-50 tracking-tight"
                                >
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
