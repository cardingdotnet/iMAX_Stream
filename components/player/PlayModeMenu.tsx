'use client';

/**
 * PlayModeMenu — popover for selecting how the queue is ordered.
 *
 * Triggered from a small icon button in the PlayerBar (replaces the bare
 * shuffle button). Brand-correct: ink surfaces, cream text, coral accent
 * used sparingly (active mode only), Fraunces for the heading word,
 * lucide icons at stroke 1.5.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ListOrdered,
  Shuffle,
  Users,
  Tag,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Clock,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { usePlayerStore } from '@/lib/player/store';
import { PLAY_MODE_META, PLAY_MODES, PlayMode } from '@/lib/playlist/play-modes';
import { cn } from '@/lib/utils';

const ICONS: Record<PlayMode, LucideIcon> = {
  'sequential': ListOrdered,
  'smart-shuffle': Shuffle,
  'by-artist': Users,
  'by-genre': Tag,
  'longest-first': ArrowDownWideNarrow,
  'shortest-first': ArrowUpNarrowWide,
  'recently-added': Clock,
};

interface PlayModeMenuProps {
  /** Optional label override; defaults to "Order". */
  triggerLabel?: string;
  /** Where the popover anchors. PlayerBar uses 'top'. */
  placement?: 'top' | 'bottom';
}

export default function PlayModeMenu({
  placement = 'top',
}: PlayModeMenuProps) {
  const playMode = usePlayerStore((s) => s.playMode);
  const setPlayMode = usePlayerStore((s) => s.setPlayMode);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const ActiveIcon = ICONS[playMode];
  const isAccent = playMode !== 'sequential';

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Order: ${PLAY_MODE_META[playMode].label}`}
        title={`Order: ${PLAY_MODE_META[playMode].label}`}
        className={cn(
          'transition-all relative',
          // Coral budget: only when a non-default mode is active (one tiny
          // accent in the bar — counts toward the per-viewport coral allowance).
          isAccent
            ? 'text-coral-500 hover:text-coral-400'
            : 'text-cream-300 hover:text-cream-100 hover:scale-110'
        )}
      >
        <ActiveIcon className="w-4 h-4" strokeWidth={1.75} />
        {isAccent && (
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-coral-500 rounded-full" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute right-0 z-50 w-72 rounded-md',
            'bg-ink-800 border border-ink-500/60',
            'shadow-2xl shadow-black/40',
            'overflow-hidden',
            placement === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'
          )}
          style={{
            // Token-driven motion per BRAND §7
            animation: 'fadeIn 200ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div className="px-4 pt-4 pb-2">
            <div className="text-eyebrow text-cream-500">Queue</div>
            <div className="font-serif text-cream-50 text-lg leading-tight">
              How should this <span className="italic font-light">play</span>?
            </div>
          </div>

          <div className="rule mx-4" />

          <ul className="py-2">
            {PLAY_MODES.map((mode) => {
              const meta = PLAY_MODE_META[mode];
              const Icon = ICONS[mode];
              const active = mode === playMode;
              return (
                <li key={mode}>
                  <button
                    type="button"
                    onClick={() => {
                      setPlayMode(mode);
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-2.5 text-left',
                      'transition-colors',
                      'hover:bg-ink-600/60',
                      active && 'bg-ink-700/40'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4 mt-0.5 shrink-0',
                        active ? 'text-coral-500' : 'text-cream-300'
                      )}
                      strokeWidth={1.75}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-sm',
                            active ? 'text-cream-50' : 'text-cream-100'
                          )}
                        >
                          {meta.label}
                        </span>
                        {active && (
                          <Check
                            className="w-3.5 h-3.5 text-coral-500 ml-auto"
                            strokeWidth={2}
                          />
                        )}
                      </div>
                      <div className="text-xs text-cream-500 mt-0.5">
                        {meta.description}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
