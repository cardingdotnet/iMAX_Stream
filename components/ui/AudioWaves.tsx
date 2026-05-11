'use client';

import { cn } from '@/lib/utils';

interface AudioWavesProps {
  playing?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

/**
 * Animated audio wave bars (Spotify-style now playing indicator)
 */
export default function AudioWaves({ 
  playing = true, 
  className,
  size = 'md',
  color = '#1DB954'
}: AudioWavesProps) {
  const sizeClasses = {
    sm: 'h-3 gap-[2px]',
    md: 'h-4 gap-[3px]',
    lg: 'h-6 gap-1',
  };
  
  const barWidth = {
    sm: 'w-[2px]',
    md: 'w-[3px]',
    lg: 'w-1',
  };

  return (
    <div 
      className={cn(
        'inline-flex items-center justify-center',
        sizeClasses[size],
        className
      )}
    >
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={cn(
            barWidth[size],
            'h-full rounded-full',
            playing && 'origin-center'
          )}
          style={{
            backgroundColor: color,
            animation: playing 
              ? `wave 1.2s ease-in-out ${(i - 1) * 0.15}s infinite`
              : 'none',
            transform: playing ? undefined : 'scaleY(0.4)',
          }}
        />
      ))}
    </div>
  );
}
