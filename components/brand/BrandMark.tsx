import { cn } from '@/lib/utils';

/**
 * EgMax brand mark — geometric monogram.
 *
 * The mark is a stylized "M" peak with an "E" baseline serif, evoking both
 * a music waveform peak and the EgMax wordmark initials. Scales cleanly
 * from a 16px favicon to a 200px hero element.
 *
 * Usage:
 *   <BrandMark size={32} />            → 32px square mark
 *   <BrandMark variant="wordmark" />   → mark + "EgMax" wordmark
 *   <BrandMark variant="stacked" />    → mark above wordmark (login hero)
 */

interface BrandMarkProps {
  size?: number;
  variant?: 'mark' | 'wordmark' | 'stacked';
  className?: string;
  monochrome?: boolean;
}

export function BrandMark({
  size = 32,
  variant = 'mark',
  className,
  monochrome = false,
}: BrandMarkProps) {
  const accent = monochrome ? 'currentColor' : '#FF5E3A';
  const ink = 'currentColor';

  const Mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden
    >
      {/* Outer rounded square — the disc/cassette */}
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="11"
        fill="none"
        stroke={ink}
        strokeOpacity="0.25"
        strokeWidth="1.25"
      />
      {/* The M-peak waveform */}
      <path
        d="M 11 33 L 18 33 L 22 21 L 26 33 L 30 27 L 37 33"
        fill="none"
        stroke={ink}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The accent dot — the play-head */}
      <circle cx="37" cy="33" r="2.25" fill={accent} />
    </svg>
  );

  if (variant === 'mark') {
    return <span className={cn('inline-flex', className)}>{Mark}</span>;
  }

  if (variant === 'stacked') {
    return (
      <div className={cn('inline-flex flex-col items-center gap-3', className)}>
        {Mark}
        <Wordmark size={Math.max(14, Math.round(size * 0.42))} />
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      {Mark}
      <Wordmark size={Math.max(14, Math.round(size * 0.55))} />
    </div>
  );
}

/**
 * EgMax wordmark — set in the editorial serif with custom kerning.
 * Uses the `font-serif` (Fraunces/Instrument) at heavy weight.
 */
export function Wordmark({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-serif font-medium tracking-tight leading-none select-none',
        className
      )}
      style={{ fontSize: `${size}px`, letterSpacing: '-0.02em' }}
    >
      Eg<span className="text-coral-500">M</span>ax
    </span>
  );
}

/**
 * Tiny monochrome version for tight UI (e.g. the toaster icon).
 */
export function MarkOnly({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return <BrandMark size={size} variant="mark" className={className} monochrome />;
}
