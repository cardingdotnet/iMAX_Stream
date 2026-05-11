'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, LogOut, Menu } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface TopBarProps {
  username: string;
  displayName: string;
  onMobileMenuToggle: () => void;
}

export default function TopBar({
  username,
  displayName,
  onMobileMenuToggle,
}: TopBarProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      const main = document.querySelector('main');
      if (main) setScrolled(main.scrollTop > 16);
    }
    const main = document.querySelector('main');
    main?.addEventListener('scroll', handleScroll);
    return () => main?.removeEventListener('scroll', handleScroll);
  }, []);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Signed out');
      router.push('/login');
      router.refresh();
    } catch (err) {
      toast.error('Sign out failed');
    }
  }

  // Initial — flat, monogram-style, single coral accent.
  const initial = (displayName || username || 'U').charAt(0).toUpperCase();

  return (
    <header
      className={cn(
        'h-14 sm:h-16 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30',
        'transition-all duration-300',
        scrolled
          ? 'bg-ink-900/80 backdrop-blur-2xl border-b border-[var(--line-soft)]'
          : 'bg-transparent'
      )}
    >
      <div className="flex items-center gap-1">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 -ml-2 hover:bg-white/[0.06] rounded-md transition-colors text-cream-200"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" strokeWidth={1.75} />
        </button>

        {/* Desktop nav arrows — paper-thin, editorial */}
        <button
          onClick={() => router.back()}
          className="hidden sm:flex w-8 h-8 hover:bg-white/[0.06] rounded-full items-center justify-center transition-colors text-cream-300 hover:text-cream-50"
          aria-label="Back"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          onClick={() => router.forward()}
          className="hidden sm:flex w-8 h-8 hover:bg-white/[0.06] rounded-full items-center justify-center transition-colors text-cream-300 hover:text-cream-50"
          aria-label="Forward"
        >
          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2.5 hover:bg-white/[0.04] py-1 pl-1 pr-3 rounded-full transition-colors group"
        >
          <span
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center',
              'bg-coral-500/15 border border-coral-500/30 text-coral-500',
              'text-[11px] font-semibold tracking-tight',
              'group-hover:bg-coral-500/20 transition-colors'
            )}
          >
            {initial}
          </span>
          <span className="hidden sm:inline text-sm font-medium text-cream-100 max-w-[160px] truncate tracking-tight">
            {displayName || username}
          </span>
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-2 w-64 bg-ink-800 border border-[var(--line-soft)] rounded-lg shadow-2xl z-50 overflow-hidden animate-scale-in">
              <div className="px-4 py-4 flex items-center gap-3 border-b border-[var(--line-soft)]">
                <span className="w-10 h-10 rounded-full flex items-center justify-center bg-coral-500/15 border border-coral-500/30 text-coral-500 text-base font-semibold">
                  {initial}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-cream-50 truncate tracking-tight">
                    {displayName}
                  </p>
                  <p className="text-xs text-cream-500 truncate">@{username}</p>
                </div>
              </div>

              <div className="p-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-sm rounded-md text-cream-200 hover:text-cream-50"
                >
                  <LogOut className="w-4 h-4" strokeWidth={1.75} />
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
