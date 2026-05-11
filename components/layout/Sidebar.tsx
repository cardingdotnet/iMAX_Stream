'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, Search, Library, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/lib/player/store';
import { BrandMark, Wordmark } from '@/components/brand/BrandMark';
import { NowPlayingBars } from '@/components/brand/PlayBadge';
import toast from 'react-hot-toast';

interface Playlist {
  id: string;
  name: string;
}

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ isMobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [creating, setCreating] = useState(false);
  const { currentTrack, isPlaying } = usePlayerStore();

  useEffect(() => {
    fetchPlaylists();
  }, []);

  useEffect(() => {
    onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function fetchPlaylists() {
    try {
      const res = await fetch('/api/playlists');
      const data = await res.json();
      if (res.ok) {
        setPlaylists(data.playlists || []);
      }
    } catch (err) {
      console.error('Failed to load playlists:', err);
    }
  }

  async function createPlaylist() {
    if (creating) return;
    setCreating(true);
    try {
      const name = `New Playlist ${new Date().toLocaleDateString('en', {
        month: 'short',
        day: 'numeric',
      })}`;
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create');
        return;
      }
      toast.success('Playlist created');
      await fetchPlaylists();
      router.push(`/playlist/${data.playlist.id}`);
    } finally {
      setCreating(false);
    }
  }

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/search', label: 'Search', icon: Search },
    { href: '/library', label: 'Library', icon: Library },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/70 z-40 backdrop-blur-sm animate-fade-in"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          'flex flex-col bg-ink-800/95 backdrop-blur-2xl border-r border-[var(--line-soft)]',
          'transition-transform duration-300 ease-out',
          'lg:relative lg:translate-x-0 lg:w-[260px]',
          'fixed inset-y-0 left-0 z-50 w-[280px]',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header — masthead style */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <BrandMark size={28} className="opacity-90 group-hover:opacity-100 transition-opacity" />
            <Wordmark size={18} />
          </Link>

          <button
            onClick={onMobileClose}
            className="lg:hidden p-1.5 hover:bg-white/[0.06] rounded-md transition-colors text-cream-300"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Eyebrow rule */}
        <div className="rule mx-5" />

        {/* Main Nav */}
        <nav className="px-3 py-4">
          <ul className="space-y-0.5">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    prefetch
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium tracking-tight',
                      'transition-colors duration-150 relative group',
                      active
                        ? 'text-cream-50 bg-white/[0.05]'
                        : 'text-cream-300 hover:text-cream-50 hover:bg-white/[0.03]'
                    )}
                  >
                    {/* Coral indicator on active */}
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-coral-500 rounded-r-full" />
                    )}
                    <Icon
                      className={cn(
                        'w-[18px] h-[18px] transition-colors',
                        active ? 'text-cream-50' : 'text-cream-300 group-hover:text-cream-50'
                      )}
                      strokeWidth={1.75}
                    />
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="rule mx-5" />

        {/* Playlists section */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 px-3 py-4">
          <div className="flex items-center justify-between px-3 mb-3">
            <p className="eyebrow text-cream-500">Your Library</p>
            <button
              onClick={createPlaylist}
              disabled={creating}
              title="Create playlist"
              className="p-1.5 hover:bg-white/[0.06] rounded-md transition-colors text-cream-300 hover:text-cream-50 disabled:opacity-40"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          <ul className="overflow-y-auto flex-1 space-y-0.5">
            {playlists.length === 0 ? (
              <li className="px-3 py-6 text-center">
                <p className="text-sm text-cream-300 font-serif italic">
                  No playlists yet
                </p>
                <p className="text-xs text-cream-500 mt-1.5">
                  Use + to create one
                </p>
              </li>
            ) : (
              playlists.map((p) => {
                const active = pathname === `/playlist/${p.id}`;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/playlist/${p.id}`}
                      prefetch
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors duration-150',
                        active
                          ? 'bg-white/[0.05] text-cream-50'
                          : 'text-cream-300 hover:text-cream-50 hover:bg-white/[0.03]'
                      )}
                    >
                      <span className="truncate flex-1 tracking-tight">{p.name}</span>
                      {active && currentTrack && (
                        <NowPlayingBars paused={!isPlaying} />
                      )}
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* Footer brand line */}
        <div className="rule mx-5" />
        <div className="px-5 py-3">
          <p className="text-[10px] text-cream-500 tracking-wider uppercase">
            EgMax · v1.0
          </p>
        </div>
      </aside>
    </>
  );
}
