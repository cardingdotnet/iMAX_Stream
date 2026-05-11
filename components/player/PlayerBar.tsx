'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Volume1,
  Repeat, Repeat1, Music, Loader2, ChevronDown, Heart
} from 'lucide-react';
import { usePlayerStore } from '@/lib/player/store';
import { formatDuration } from '@/lib/utils';
import { cn } from '@/lib/utils';
import AudioWaves from '@/components/ui/AudioWaves';
import PlayModeMenu from '@/components/player/PlayModeMenu';

export default function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    repeat,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleRepeat,
  } = usePlayerStore();

  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [liked, setLiked] = useState(false);

  // Lock body scroll when full-screen player is open
  useEffect(() => {
    if (mobileExpanded) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [mobileExpanded]);

  if (!currentTrack) return null;

  const progressPercent = duration > 0 
    ? ((isDragging ? dragValue : currentTime) / duration) * 100 
    : 0;

  function handleProgressChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDragValue(parseFloat(e.target.value));
  }

  function handleProgressMouseDown() {
    setIsDragging(true);
    setDragValue(currentTime);
  }

  function handleProgressMouseUp() {
    seek(dragValue);
    setIsDragging(false);
  }

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <>
      {/* === FULL-SCREEN MOBILE PLAYER === */}
      {mobileExpanded && (
        <div 
          className="lg:hidden fixed inset-0 z-50 flex flex-col overflow-hidden animate-fade-in"
          style={{
            background: `
              radial-gradient(ellipse at top, rgba(168, 85, 247, 0.4), transparent 60%),
              radial-gradient(ellipse at bottom, rgba(29, 185, 84, 0.3), transparent 60%),
              #0a0a0a
            `
          }}
        >
          {/* Animated background blob */}
          <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-coral-500/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
          
          {/* Top bar */}
          <div className="flex items-center justify-between p-4 safe-top relative z-10">
            <button
              onClick={() => setMobileExpanded(false)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Minimize"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-white/60">Now Playing</p>
            </div>
            <div className="w-10" />
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 relative z-10">
            {/* Vinyl/Album art */}
            <div className="relative w-full max-w-[320px] aspect-square">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-coral-500/15 blur-3xl rounded-full" />
              
              <div className={cn(
                "relative w-full h-full rounded-2xl overflow-hidden shadow-2xl",
                isPlaying && "animate-pulse-glow"
              )}>
                {currentTrack.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={currentTrack.artworkUrl} 
                    alt={currentTrack.title}
                    className={cn(
                      "w-full h-full object-cover transition-transform duration-1000",
                      isPlaying && "scale-105"
                    )}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-700 to-blue-700 flex items-center justify-center">
                    <Music className="w-32 h-32 text-white/40" />
                  </div>
                )}
                
                {/* Vinyl reflection effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />
              </div>
            </div>

            {/* Track info */}
            <div className="text-center w-full px-4 space-y-1">
              <p className="text-2xl font-bold truncate">{currentTrack.title}</p>
              <p className="text-base text-white/70 truncate">{currentTrack.artist}</p>
            </div>

            {/* Progress */}
            <div className="w-full px-4">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={isDragging ? dragValue : currentTime}
                onChange={handleProgressChange}
                onMouseDown={handleProgressMouseDown}
                onMouseUp={handleProgressMouseUp}
                onTouchStart={handleProgressMouseDown}
                onTouchEnd={handleProgressMouseUp}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer slider-thumb-mobile"
                style={{
                  background: `linear-gradient(to right, #fff 0%, #fff ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%, rgba(255,255,255,0.2) 100%)`,
                }}
              />
              <div className="flex justify-between text-xs text-white/60 mt-2 font-mono">
                <span>{formatDuration((isDragging ? dragValue : currentTime) * 1000)}</span>
                <span>{formatDuration((duration || 0) * 1000)}</span>
              </div>
            </div>

            {/* Big controls */}
            <div className="flex items-center justify-around w-full max-w-md no-select">
              <div className="p-2">
                <PlayModeMenu placement="top" />
              </div>
              
              <button onClick={previous} className="text-white p-2 hover:scale-110 transition-transform">
                <SkipBack className="w-9 h-9" fill="currentColor" />
              </button>

              <button
                onClick={togglePlay}
                disabled={isLoading}
                className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 shadow-2xl"
              >
                {isLoading ? (
                  <Loader2 className="w-9 h-9 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-10 h-10" fill="currentColor" />
                ) : (
                  <Play className="w-10 h-10 ml-1" fill="currentColor" />
                )}
              </button>

              <button onClick={next} className="text-white p-2 hover:scale-110 transition-transform">
                <SkipForward className="w-9 h-9" fill="currentColor" />
              </button>

              <button
                onClick={toggleRepeat}
                className={cn(
                  'p-2 transition-all',
                  repeat !== 'none' ? 'text-cream-50 scale-110' : 'text-cream-300 hover:text-cream-100'
                )}
                title={`Repeat: ${repeat}`}
              >
                {repeat === 'one' ? <Repeat1 className="w-5 h-5" strokeWidth={1.75} /> : <Repeat className="w-5 h-5" strokeWidth={1.75} />}
              </button>
            </div>

            {/* Like button */}
            <button
              onClick={() => setLiked(!liked)}
              className="p-3 hover:scale-110 transition-transform"
            >
              <Heart 
                className={cn("w-6 h-6", liked ? "text-red-500" : "text-white/60")} 
                fill={liked ? "currentColor" : "none"}
              />
            </button>
          </div>
        </div>
      )}

      {/* === BOTTOM PLAYER BAR === */}
      <div className={cn(
        "flex-shrink-0 relative",
        "bg-gradient-to-t from-spotify-darker-gray to-spotify-dark-gray",
        "border-t border-white/[0.04]",
        "safe-bottom"
      )}>
        {/* Subtle top glow line when playing */}
        {isPlaying && (
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-coral-500/30 to-transparent" />
        )}

        {/* MOBILE LAYOUT */}
        <div className="lg:hidden">
          {/* Progress bar (top) */}
          <div className="px-2 pt-1.5">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={isDragging ? dragValue : currentTime}
              onChange={handleProgressChange}
              onMouseDown={handleProgressMouseDown}
              onMouseUp={handleProgressMouseUp}
              onTouchStart={handleProgressMouseDown}
              onTouchEnd={handleProgressMouseUp}
              className="w-full h-1 rounded-full appearance-none cursor-pointer slider-thumb"
              style={{
                background: `linear-gradient(to right, #1DB954 0%, #1DB954 ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%, rgba(255,255,255,0.15) 100%)`,
              }}
            />
          </div>

          <div className="flex items-center px-3 py-2 gap-3">
            <button
              onClick={() => setMobileExpanded(true)}
              className="flex items-center gap-3 flex-1 min-w-0 active:opacity-70 transition-opacity"
            >
              <div className="relative w-11 h-11 rounded-md flex-shrink-0 overflow-hidden shadow-lg">
                {currentTrack.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={currentTrack.artworkUrl} 
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                    <Music className="w-5 h-5 text-white/80" />
                  </div>
                )}
              </div>
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold truncate">{currentTrack.title}</p>
                <p className="text-xs text-white/60 truncate">{currentTrack.artist}</p>
              </div>
            </button>

            <div className="flex items-center gap-0.5">
              <button
                onClick={previous}
                className="p-2 text-white active:opacity-70"
                aria-label="Previous"
              >
                <SkipBack className="w-5 h-5" fill="currentColor" />
              </button>

              <button
                onClick={togglePlay}
                disabled={isLoading}
                className="p-2 text-white active:scale-95 transition-transform"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isLoading ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-7 h-7" fill="currentColor" />
                ) : (
                  <Play className="w-7 h-7" fill="currentColor" />
                )}
              </button>

              <button
                onClick={next}
                className="p-2 text-white active:opacity-70"
                aria-label="Next"
              >
                <SkipForward className="w-5 h-5" fill="currentColor" />
              </button>
            </div>
          </div>
        </div>

        {/* DESKTOP LAYOUT */}
        <div className="hidden lg:flex h-24 items-center px-4 gap-4">
          {/* Track Info */}
          <div className="flex items-center gap-3 w-1/4 min-w-0">
            <div className="relative w-14 h-14 rounded-md flex-shrink-0 overflow-hidden shadow-lg group">
              {currentTrack.artworkUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={currentTrack.artworkUrl} 
                  alt={currentTrack.title}
                  className={cn(
                    "w-full h-full object-cover transition-transform duration-700",
                    isPlaying && "scale-110"
                  )}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                  <Music className="w-6 h-6 text-white/80" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate hover:underline cursor-pointer">
                {currentTrack.title}
              </p>
              <p className="text-xs text-white/60 truncate hover:underline cursor-pointer">
                {currentTrack.artist}
              </p>
            </div>
            <button
              onClick={() => setLiked(!liked)}
              className="p-2 hover:scale-110 transition-transform flex-shrink-0"
              title={liked ? 'Unlike' : 'Like'}
            >
              <Heart 
                className={cn("w-4 h-4", liked ? "text-coral-500" : "text-white/40 hover:text-white")} 
                fill={liked ? "currentColor" : "none"}
              />
            </button>
          </div>

          {/* Controls */}
          <div className="flex-1 flex flex-col items-center gap-2 max-w-2xl mx-auto">
            <div className="flex items-center gap-5">
              <PlayModeMenu placement="top" />

              <button
                onClick={previous}
                className="text-white/60 hover:text-white hover:scale-110 transition-all"
                title="Previous"
              >
                <SkipBack className="w-5 h-5" fill="currentColor" />
              </button>

              <button
                onClick={togglePlay}
                disabled={isLoading}
                className={cn(
                  "w-10 h-10 bg-white text-black rounded-full flex items-center justify-center transition-all disabled:opacity-50",
                  "hover:scale-110 active:scale-95",
                  isPlaying && "shadow-lg shadow-white/20"
                )}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5" fill="currentColor" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                )}
              </button>

              <button
                onClick={next}
                className="text-white/60 hover:text-white hover:scale-110 transition-all"
                title="Next"
              >
                <SkipForward className="w-5 h-5" fill="currentColor" />
              </button>

              <button
                onClick={toggleRepeat}
                className={cn(
                  'transition-all relative',
                  repeat !== 'none' 
                    ? 'text-cream-50' 
                    : 'text-cream-300 hover:text-cream-100 hover:scale-110'
                )}
                title={`Repeat: ${repeat}`}
              >
                {repeat === 'one' ? (
                  <Repeat1 className="w-4 h-4" strokeWidth={1.75} />
                ) : (
                  <Repeat className="w-4 h-4" strokeWidth={1.75} />
                )}
                {repeat !== 'none' && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-cream-50 rounded-full" />
                )}
              </button>
            </div>

            <div className="w-full flex items-center gap-2 group">
              <span className="text-xs text-white/60 min-w-[40px] text-right font-mono tabular-nums">
                {formatDuration((isDragging ? dragValue : currentTime) * 1000)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={isDragging ? dragValue : currentTime}
                onChange={handleProgressChange}
                onMouseDown={handleProgressMouseDown}
                onMouseUp={handleProgressMouseUp}
                onTouchStart={handleProgressMouseDown}
                onTouchEnd={handleProgressMouseUp}
                className="flex-1 h-1 rounded-full appearance-none cursor-pointer slider-thumb"
                style={{
                  background: `linear-gradient(to right, #fff 0%, #fff ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%, rgba(255,255,255,0.15) 100%)`,
                }}
              />
              <span className="text-xs text-white/60 min-w-[40px] font-mono tabular-nums">
                {formatDuration((duration || 0) * 1000)}
              </span>
            </div>
          </div>

          {/* Volume + Now Playing indicator */}
          <div className="w-1/4 flex justify-end items-center gap-3">
            {isPlaying && (
              <AudioWaves size="md" className="text-cream-50" />
            )}
            
            <div className="flex items-center gap-2 group">
              <button
                onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                className="text-white/60 hover:text-white hover:scale-110 transition-all"
                title={volume > 0 ? 'Mute' : 'Unmute'}
              >
                <VolumeIcon className="w-5 h-5" />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-24 h-1 rounded-full appearance-none cursor-pointer slider-thumb"
                style={{
                  background: `linear-gradient(to right, #fff 0%, #fff ${volume * 100}%, rgba(255,255,255,0.15) ${volume * 100}%, rgba(255,255,255,0.15) 100%)`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
