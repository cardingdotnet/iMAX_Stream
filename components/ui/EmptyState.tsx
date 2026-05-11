import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

/**
 * Editorial empty state. Used for "no playlists yet", "library empty",
 * "playlist has no tracks". Replaces the previous emoji-prefixed copy
 * with a quiet illustrated SVG and editorial typography.
 */

interface EmptyStateProps {
  illustration?: 'crate' | 'cassette' | 'wave' | 'disc';
  eyebrow?: string;
  title: string;
  body?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({
  illustration = 'crate',
  eyebrow,
  title,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        'max-w-md mx-auto py-16 sm:py-24 px-6',
        className
      )}
    >
      <Illustration kind={illustration} />

      {eyebrow && (
        <p className="eyebrow mt-8 mb-3 text-coral-500">{eyebrow}</p>
      )}

      <h2 className="font-serif text-3xl sm:text-4xl text-cream-50 leading-[1.05] tracking-tight text-balance">
        {title}
      </h2>

      {body && (
        <p className="mt-4 text-cream-300 text-sm sm:text-base leading-relaxed text-balance">
          {body}
        </p>
      )}

      {action && (
        <div className="mt-8">
          {action.href ? (
            <Link href={action.href} className="btn-accent">
              {action.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button onClick={action.onClick} className="btn-accent">
              {action.label}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Illustration({ kind }: { kind: 'crate' | 'cassette' | 'wave' | 'disc' }) {
  const stroke = '#A09CA0';
  const accent = '#FF5E3A';

  if (kind === 'cassette') {
    return (
      <svg width="120" height="80" viewBox="0 0 120 80" fill="none" aria-hidden>
        <rect x="2" y="2" width="116" height="76" rx="6" stroke={stroke} strokeWidth="1.5" />
        <rect x="14" y="14" width="92" height="32" rx="3" stroke={stroke} strokeWidth="1" opacity="0.5" />
        <circle cx="35" cy="30" r="9" stroke={stroke} strokeWidth="1.5" />
        <circle cx="35" cy="30" r="2.5" fill={accent} />
        <circle cx="85" cy="30" r="9" stroke={stroke} strokeWidth="1.5" />
        <circle cx="85" cy="30" r="2.5" fill={stroke} opacity="0.6" />
        <path d="M 14 60 L 106 60" stroke={stroke} strokeWidth="1" opacity="0.3" />
        <path d="M 14 66 L 90 66" stroke={stroke} strokeWidth="1" opacity="0.2" />
      </svg>
    );
  }

  if (kind === 'wave') {
    return (
      <svg width="140" height="60" viewBox="0 0 140 60" fill="none" aria-hidden>
        {[...Array(28)].map((_, i) => {
          const h = 8 + Math.sin(i * 0.55) * 16 + Math.cos(i * 0.3) * 8;
          return (
            <rect
              key={i}
              x={i * 5}
              y={30 - h / 2}
              width="2"
              height={Math.abs(h)}
              rx="1"
              fill={i === 14 ? accent : stroke}
              opacity={i === 14 ? 1 : 0.4}
            />
          );
        })}
      </svg>
    );
  }

  if (kind === 'disc') {
    return (
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden>
        <circle cx="60" cy="60" r="56" stroke={stroke} strokeWidth="1" opacity="0.3" />
        <circle cx="60" cy="60" r="44" stroke={stroke} strokeWidth="1" opacity="0.4" />
        <circle cx="60" cy="60" r="28" stroke={stroke} strokeWidth="1" opacity="0.5" />
        <circle cx="60" cy="60" r="12" fill={accent} opacity="0.15" />
        <circle cx="60" cy="60" r="3" fill={accent} />
      </svg>
    );
  }

  // crate (default)
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" aria-hidden>
      <path d="M 8 30 L 60 12 L 112 30 L 112 88 L 8 88 Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 8 30 L 60 48 L 112 30" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 60 48 L 60 88" stroke={stroke} strokeWidth="1" opacity="0.4" />
      <rect x="22" y="56" width="14" height="22" rx="1" fill={accent} opacity="0.3" />
      <rect x="38" y="58" width="14" height="20" rx="1" fill={stroke} opacity="0.25" />
      <rect x="68" y="56" width="14" height="22" rx="1" fill={stroke} opacity="0.2" />
      <rect x="84" y="60" width="14" height="18" rx="1" fill={stroke} opacity="0.15" />
    </svg>
  );
}
