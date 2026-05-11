import { cn } from '@/lib/utils';

/**
 * EgMax play / pause icon — a custom circular play button.
 *
 * Designed to replace lucide's Play/Pause for the primary play action
 * (where it really matters — playlist hero, big track rows). Smaller
 * actions still use lucide for consistency and tree-shaking.
 */

interface PlayBadgeProps {
  size?: number;
  state?: 'play' | 'pause' | 'loading';
  className?: string;
  /** Inverted: dark icon on light bg (used on hero hover overlays). */
  inverted?: boolean;
}

export function PlayBadge({
  size = 56,
  state = 'play',
  className,
  inverted = false,
}: PlayBadgeProps) {
  const fill = inverted ? '#0B0B0E' : '#F5F1EA';
  const bg = inverted ? '#F5F1EA' : '#FF5E3A';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        'transition-transform duration-200 will-change-transform',
        'shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)]',
        'hover:scale-105 active:scale-95',
        className
      )}
      style={{
        width: size,
        height: size,
        background: bg,
      }}
      aria-hidden
    >
      <svg
        width={Math.round(size * 0.42)}
        height={Math.round(size * 0.42)}
        viewBox="0 0 24 24"
        fill={fill}
      >
        {state === 'play' && (
          // Slightly offset triangle (optical centering) — premium detail
          <path d="M 8 5.5 L 19 12 L 8 18.5 Z" />
        )}
        {state === 'pause' && (
          <>
            <rect x="7"  y="5" width="3.5" height="14" rx="0.6" />
            <rect x="14" y="5" width="3.5" height="14" rx="0.6" />
          </>
        )}
        {state === 'loading' && (
          <circle
            cx="12" cy="12" r="8"
            fill="none"
            stroke={fill}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="14 30"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 12 12"
              to="360 12 12"
              dur="0.9s"
              repeatCount="indefinite"
            />
          </circle>
        )}
      </svg>
    </span>
  );
}

/**
 * Now-playing visualizer — three minimalist bars.
 * Replaces the Spotify-style 4-bar dancer with something quieter and
 * more editorial.
 */
export function NowPlayingBars({
  paused,
  className,
}: {
  paused?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn('now-playing-bars', paused && 'paused', className)}
      aria-label={paused ? 'Paused' : 'Now playing'}
    >
      <span /><span /><span /><span />
    </span>
  );
}
