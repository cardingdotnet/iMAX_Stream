'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Music, Trash2, Copy, Check, Share2, Loader2,
  ExternalLink, Play, Pause, Edit2, MoreHorizontal, Clock,
  Volume2, Shuffle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDuration, getStreamUrl, getStreamUrlWithExtension, getRadioUrl } from '@/lib/utils';
import { usePlayerStore, PlayerTrack } from '@/lib/player/store';
import { TrackListSkeleton } from '@/components/ui/Skeletons';
import AudioWaves from '@/components/ui/AudioWaves';
import { EmptyState } from '@/components/ui/EmptyState';

interface PlaylistTrack {
  id: number;
  title: string;
  artist: string;
  duration_ms: number;
  artwork_url: string | null;
  position: number;
}

interface Playlist {
  id: string;
  name: string;
  short_code: string;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  stream_token: string;
  play_count: number;
  user_id: string;
}

export default function PlaylistPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedClean, setCopiedClean] = useState(false);
  const [copiedM3u, setCopiedM3u] = useState(false);
  const [copiedRadio, setCopiedRadio] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showShareCard, setShowShareCard] = useState(false);
  
  const { 
    currentTrack, isPlaying, playQueue, togglePlay 
  } = usePlayerStore();

  useEffect(() => {
    loadPlaylist();
  }, [id]);

  async function loadPlaylist() {
    setLoading(true);
    try {
      const res = await fetch(`/api/playlists/${id}`);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to load');
        router.push('/library');
        return;
      }

      setPlaylist(data.playlist);
      setTracks(data.tracks);
      setEditName(data.playlist.name);
    } catch (err) {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }

  function buildQueue(): PlayerTrack[] {
    return tracks.map(t => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      duration: t.duration_ms,
      artworkUrl: t.artwork_url,
    }));
  }

  function playAll() {
    if (tracks.length === 0) return;
    playQueue(buildQueue(), 0, 'sequential');
  }

  function smartShuffleAll() {
    if (tracks.length === 0) return;
    // Pick a random start index from the supplied list; playQueue with the
    // 'smart-shuffle' mode will re-order around it.
    const startIdx = Math.floor(Math.random() * tracks.length);
    playQueue(buildQueue(), startIdx, 'smart-shuffle');
  }

  function playTrackAt(index: number) {
    const track = tracks[index];
    if (!track) return;

    if (currentTrack?.id === track.id) {
      togglePlay();
      return;
    }

    playQueue(buildQueue(), index);
  }

  const isPlaylistPlaying = isPlaying && tracks.some(t => t.id === currentTrack?.id);

  async function removeTrack(trackId: number) {
    if (!confirm('Remove this track from the playlist?')) return;

    try {
      const res = await fetch(
        `/api/playlists/${id}/tracks?trackId=${trackId}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        toast.error('Failed to remove track');
        return;
      }

      toast.success('Track removed');
      setTracks(tracks.filter(t => t.id !== trackId));
    } catch (err) {
      toast.error('Network error');
    }
  }

  async function deletePlaylist() {
    if (!confirm('Delete this playlist? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/playlists/${id}`, { method: 'DELETE' });

      if (!res.ok) {
        toast.error('Failed to delete');
        return;
      }

      toast.success('Playlist deleted');
      router.push('/library');
    } catch (err) {
      toast.error('Network error');
    }
  }

  async function saveRename() {
    if (!playlist || !editName.trim() || editName === playlist.name) {
      setEditing(false);
      return;
    }

    try {
      const res = await fetch(`/api/playlists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to rename');
        return;
      }

      setPlaylist(data.playlist);
      toast.success('Playlist renamed!');
      setEditing(false);
    } catch (err) {
      toast.error('Network error');
    }
  }

  async function copyToClipboard(text: string, setter: (b: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setter(false), 2000);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setter(true);
      toast.success('Copied!');
      setTimeout(() => setter(false), 2000);
    }
  }

  if (loading) {
    return (
      <div>
        <div className="grain hero-gradient px-6 sm:px-12 lg:px-16 pt-12 sm:pt-16 pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-8">
            <div className="w-44 h-44 sm:w-56 sm:h-56 mx-auto sm:mx-0 bg-white/[0.04] rounded-md" />
            <div className="flex-1 space-y-3">
              <div className="h-3 bg-white/[0.04] rounded w-16" />
              <div className="h-12 bg-white/[0.04] rounded w-3/4" />
              <div className="h-3 bg-white/[0.04] rounded w-1/3" />
            </div>
          </div>
        </div>
        <div className="px-6 sm:px-12 lg:px-16 mt-8">
          <TrackListSkeleton count={6} />
        </div>
      </div>
    );
  }

  if (!playlist) return null;

  const totalDuration = tracks.reduce((acc, t) => acc + t.duration_ms, 0);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const cleanUrl = getStreamUrl(playlist.short_code, origin);
  const m3uUrl = getStreamUrlWithExtension(playlist.short_code, origin);
  const radioUrl = getRadioUrl(playlist.short_code, origin);

  // Editorial hero — quiet hero gradient, no shouty colors
  const hue = playlist.id.charCodeAt(0) * 13 % 360;
  const h2 = (hue + 35) % 360;

  return (
    <div className="animate-fade-in">
      {/* === HERO HEADER === */}
      <div className="relative grain hero-gradient px-6 sm:px-12 lg:px-16 pt-12 sm:pt-16 pb-8">
        <div className="relative flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-8">
          {/* Cover art */}
          <div className="relative mx-auto sm:mx-0 group flex-shrink-0">
            <div
              className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-md overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7)]"
              style={{
                background: `
                  radial-gradient(circle at 30% 25%, hsla(${hue}, 60%, 35%, 0.85), transparent 55%),
                  radial-gradient(circle at 75% 75%, hsla(${h2}, 50%, 25%, 0.9), transparent 60%),
                  #1A1A20
                `,
              }}
            >
              {playlist.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={playlist.cover_url}
                  alt={playlist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-end p-4">
                  <Music className="w-10 h-10 text-cream-100/30" strokeWidth={1.25} />
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <p className="eyebrow text-coral-500 mb-3">Playlist</p>

            {editing ? (
              <div className="flex flex-col sm:flex-row items-center gap-2 mb-3 sm:mb-4">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRename();
                    if (e.key === 'Escape') {
                      setEditing(false);
                      setEditName(playlist.name);
                    }
                  }}
                  autoFocus
                  className="font-serif text-3xl sm:text-5xl bg-transparent border-b border-cream-300 outline-none flex-1 w-full text-center sm:text-left tracking-tight text-cream-50 pb-1"
                  maxLength={100}
                />
                <div className="flex gap-2">
                  <button onClick={saveRename} className="btn-accent text-sm">Save</button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditName(playlist.name);
                    }}
                    className="btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="group cursor-pointer mb-4 inline-flex items-center gap-3 max-w-full"
                title="Click to rename"
              >
                <h1 className="font-serif text-display-sm sm:text-display lg:text-display-lg text-cream-50 leading-[0.95] tracking-tight truncate text-balance">
                  {playlist.name}
                </h1>
                <Edit2 className="w-4 h-4 sm:w-5 sm:h-5 text-cream-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </button>
            )}

            {playlist.description && (
              <p className="text-cream-300 mb-4 text-sm sm:text-base font-serif italic max-w-xl">
                {playlist.description}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 text-xs sm:text-sm text-cream-500 tracking-tight">
              <span>{tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}</span>
              {tracks.length > 0 && (
                <>
                  <span className="text-cream-500/50">·</span>
                  <span>{formatDuration(totalDuration)}</span>
                </>
              )}
              <span className="text-cream-500/50">·</span>
              <span>{playlist.play_count} plays</span>
            </div>
          </div>
        </div>
      </div>

      {/* === ACTION BAR === */}
      <div className="px-6 sm:px-12 lg:px-16 py-6 flex items-center gap-4">
        <button
          onClick={isPlaylistPlaying ? togglePlay : playAll}
          disabled={tracks.length === 0}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center bg-coral-500 hover:bg-coral-400 active:bg-coral-600 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_8px_24px_-6px_rgba(255,94,58,0.5)] hover:shadow-[0_12px_32px_-6px_rgba(255,94,58,0.6)] active:scale-[0.97] group"
          title={isPlaylistPlaying ? 'Pause' : 'Play'}
        >
          {isPlaylistPlaying ? (
            <Pause className="w-5 h-5 sm:w-6 sm:h-6 text-cream-50" fill="currentColor" />
          ) : (
            <Play className="w-5 h-5 sm:w-6 sm:h-6 text-cream-50 ml-0.5" fill="currentColor" />
          )}
        </button>

        <button
          onClick={smartShuffleAll}
          disabled={tracks.length === 0}
          className="btn-secondary"
          title="Shuffle, with no two tracks from the same artist back-to-back"
        >
          <Shuffle className="w-4 h-4" strokeWidth={1.75} />
          Smart shuffle
        </button>

        <button
          onClick={() => setShowShareCard(!showShareCard)}
          className="btn-secondary"
        >
          <Share2 className="w-4 h-4" strokeWidth={1.75} />
          Share
        </button>

        <button className="ml-auto w-10 h-10 rounded-full hover:bg-white/[0.05] transition-colors flex items-center justify-center text-cream-300 hover:text-cream-50">
          <MoreHorizontal className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>

      {/* === SHARE CARD === */}
      {showShareCard && (
        <div className="px-6 sm:px-12 lg:px-16 mb-8 animate-fade-in-up">
          <div className="card-elevated p-6">
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <p className="eyebrow text-coral-500 mb-2">Share</p>
                <h2 className="font-serif text-2xl text-cream-50 tracking-tight">Stream anywhere</h2>
              </div>
              <p className="text-xs text-cream-500 hidden sm:block">Pick the URL for your player</p>
            </div>

            {/* IMVU Radio URL — primary */}
            <div className="mb-4 p-4 rounded-md bg-coral-500/[0.06] border border-coral-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="w-3.5 h-3.5 text-coral-500" strokeWidth={2} />
                <p className="eyebrow text-coral-500">IMVU radio · recommended</p>
              </div>
              <p className="text-xs text-cream-300 mb-3">
                Continuous MP3 stream. Paste into IMVU&apos;s room radio dialog.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={radioUrl}
                  className="input flex-1 font-mono text-xs"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => copyToClipboard(radioUrl, setCopiedRadio)}
                  className="btn-accent text-sm whitespace-nowrap"
                  disabled={tracks.length === 0}
                >
                  {copiedRadio ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
                </button>
              </div>
            </div>

            {/* Short URL */}
            <div className="mb-4">
              <p className="eyebrow text-cream-500 mb-2">Playlist URL · VLC / browsers</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={cleanUrl}
                  className="input flex-1 font-mono text-xs"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => copyToClipboard(cleanUrl, setCopiedClean)}
                  className="btn-secondary text-sm whitespace-nowrap"
                  disabled={tracks.length === 0}
                >
                  {copiedClean ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
                </button>
              </div>
            </div>

            {/* M3U URL */}
            <div className="mb-6">
              <p className="eyebrow text-cream-500 mb-2">.m3u with extension</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={m3uUrl}
                  className="input flex-1 font-mono text-xs"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => copyToClipboard(m3uUrl, setCopiedM3u)}
                  className="btn-secondary text-sm whitespace-nowrap"
                  disabled={tracks.length === 0}
                >
                  {copiedM3u ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
                </button>
              </div>
            </div>

            <div className="rule mb-4" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {['IMVU', 'VLC', 'Browsers', 'Mobile'].map(label => (
                  <span key={label} className="px-2.5 py-1 bg-white/[0.04] border border-[var(--line-soft)] rounded-full text-[11px] text-cream-300 tracking-tight">
                    {label}
                  </span>
                ))}
              </div>
              <div className="flex gap-3">
                <a
                  href={radioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cream-300 hover:text-coral-500 transition-colors inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Test radio
                </a>
                <a
                  href={cleanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cream-300 hover:text-coral-500 transition-colors inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Test playlist
                </a>
              </div>
            </div>

            {tracks.length === 0 && (
              <p className="mt-4 text-sm text-ember-500">Add tracks before sharing.</p>
            )}
          </div>
        </div>
      )}

      {/* === TRACK LIST === */}
      <div className="px-4 sm:px-8 pb-8">
        {tracks.length === 0 ? (
          <EmptyState
            illustration="wave"
            eyebrow="Empty playlist"
            title="It's quiet in here."
            body="Search SoundCloud and add tracks to bring this playlist to life."
            action={{ label: 'Find music', href: '/search' }}
          />
        ) : (
          <>
            {/* Desktop track header */}
            <div className="hidden sm:grid grid-cols-[40px,auto,1fr,auto,40px] gap-4 px-4 py-3 text-eyebrow uppercase tracking-wider text-cream-500 border-b border-[var(--line-soft)] mb-2 font-semibold">
              <span>#</span>
              <span></span>
              <span>Title</span>
              <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span></span>
            </div>

            <div className="space-y-0.5">
              {tracks.map((track, idx) => {
                const isCurrentTrack = currentTrack?.id === track.id;
                const showPause = isCurrentTrack && isPlaying;

                return (
                  <div
                    key={track.id}
                    className={`
                      flex sm:grid sm:grid-cols-[40px,auto,1fr,auto,40px]
                      gap-3 sm:gap-4 px-2 sm:px-4 py-2 rounded-md group items-center
                      transition-colors
                      ${isCurrentTrack ? 'bg-white/[0.04]' : 'hover:bg-white/[0.03]'}
                    `}
                    style={{
                      animation: 'fadeInUp 0.3s ease-out backwards',
                      animationDelay: `${idx * 25}ms`,
                    }}
                  >
                    {/* Index/Play (desktop) */}
                    <div className="hidden sm:flex w-10 items-center justify-center">
                      {isCurrentTrack && isPlaying ? (
                        <AudioWaves size="md" className="group-hover:hidden" />
                      ) : (
                        <span className={`
                          font-mono text-xs group-hover:hidden tabular-nums
                          ${isCurrentTrack ? 'text-coral-500' : 'text-cream-500'}
                        `}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                      )}
                      <button
                        onClick={() => playTrackAt(idx)}
                        className="hidden group-hover:block text-cream-50 hover:text-coral-500 transition-colors"
                      >
                        {showPause ? (
                          <Pause className="w-4 h-4" fill="currentColor" />
                        ) : (
                          <Play className="w-4 h-4" fill="currentColor" />
                        )}
                      </button>
                    </div>

                    {/* Artwork */}
                    <button
                      onClick={() => playTrackAt(idx)}
                      className="relative w-12 h-12 sm:w-10 sm:h-10 rounded-sm overflow-hidden cover-placeholder flex-shrink-0 group/art"
                    >
                      {track.artwork_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={track.artwork_url}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-4 h-4 text-cream-300/40" strokeWidth={1.25} />
                        </div>
                      )}
                      {/* Mobile play overlay */}
                      <div className="sm:hidden absolute inset-0 bg-ink-900/50 flex items-center justify-center opacity-0 group-active/art:opacity-100 transition-opacity">
                        {showPause ? (
                          <Pause className="w-5 h-5 text-cream-50" fill="currentColor" />
                        ) : (
                          <Play className="w-5 h-5 text-cream-50 ml-0.5" fill="currentColor" />
                        )}
                      </div>
                    </button>

                    {/* Title + Artist */}
                    <button
                      onClick={() => playTrackAt(idx)}
                      className="min-w-0 text-left flex-1"
                    >
                      <p className={`
                        font-medium truncate text-sm tracking-tight transition-colors
                        ${isCurrentTrack ? 'text-coral-500' : 'text-cream-50'}
                      `}>
                        {track.title}
                      </p>
                      <p className="text-xs text-cream-300 truncate mt-0.5">
                        {track.artist}
                      </p>
                    </button>

                    {/* Duration */}
                    <span className="hidden sm:inline text-xs text-cream-500 font-mono tabular-nums">
                      {formatDuration(track.duration_ms)}
                    </span>

                    {/* Remove */}
                    <button
                      onClick={() => removeTrack(track.id)}
                      className="p-2 hover:bg-white/[0.06] rounded-md transition-colors flex-shrink-0 opacity-0 sm:group-hover:opacity-100 text-cream-500 hover:text-coral-500"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Delete playlist (subtle) */}
        <div className="mt-16 pt-6 rule">
          <button
            onClick={deletePlaylist}
            className="text-cream-500 hover:text-coral-500 text-sm flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            Delete this playlist
          </button>
        </div>
      </div>
    </div>
  );
}
