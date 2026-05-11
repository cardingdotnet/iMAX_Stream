/**
 * Player Store — Global audio playback state
 *
 * Used by AudioPlayer, PlayerControls, and any track list to play/pause.
 *
 * Play modes:
 *   The store tracks a `playMode` enum (see lib/playlist/play-modes). When
 *   playQueue() is called, the supplied tracks are ordered through
 *   applyPlayMode() before being assigned to the queue. Switching mode
 *   mid-playback re-orders the REMAINING queue (everything after the current
 *   track) so the user hears the new order from the next track on, without
 *   yanking the song they're currently listening to.
 *
 *   The legacy boolean `shuffle` is kept as a DERIVED value: true whenever
 *   playMode is anything other than 'sequential'. Old call sites
 *   (PlayerBar's pre-mode shuffle button) keep working without change.
 */

import { create } from 'zustand';
import {
  applyPlayMode,
  PlayMode,
  OrderableTrack,
} from '@/lib/playlist/play-modes';

export interface PlayerTrack {
  id: number;
  title: string;
  artist: string;
  duration: number; // milliseconds
  artworkUrl: string | null;
  /** Optional fields used for play-mode ordering. Safe to omit. */
  genre?: string | null;
  addedAt?: string | number | null;
}

interface PlayerState {
  // Current state
  currentTrack: PlayerTrack | null;
  /** The queue AS CURRENTLY ORDERED (i.e. after applying playMode). */
  queue: PlayerTrack[];
  /** The original order as supplied to playQueue — used to re-derive when mode changes. */
  sourceQueue: PlayerTrack[];
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;

  // Playback state
  currentTime: number;
  duration: number;
  volume: number;

  // Repeat / play mode
  repeat: 'none' | 'all' | 'one';
  /** Active ordering. 'sequential' = old default. */
  playMode: PlayMode;
  /** DERIVED — kept for backward compatibility with components that read .shuffle. */
  shuffle: boolean;

  // Actions
  playTrack: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  playQueue: (queue: PlayerTrack[], startIndex?: number, mode?: PlayMode) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  setLoading: (loading: boolean) => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleRepeat: () => void;
  setPlayMode: (mode: PlayMode) => void;
  /** Legacy: cycles 'sequential' ↔ 'smart-shuffle'. */
  toggleShuffle: () => void;
  clearPlayer: () => void;
}

/** Convert a PlayerTrack to the OrderableTrack shape expected by play-modes. */
function toOrderable(t: PlayerTrack): OrderableTrack {
  return {
    id: t.id,
    artist: t.artist,
    genre: t.genre ?? null,
    durationMs: t.duration,
    addedAt: t.addedAt ?? null,
  };
}

/**
 * Apply a play mode to a queue, returning a re-ordered list of PlayerTracks.
 * applyPlayMode operates on OrderableTrack — we adapt in and back.
 */
function orderQueue(
  queue: PlayerTrack[],
  mode: PlayMode,
  seed: number
): PlayerTrack[] {
  if (mode === 'sequential' || queue.length <= 1) return queue.slice();
  const reordered = applyPlayMode(queue.map(toOrderable), mode, seed);
  const byId = new Map(queue.map((t) => [t.id, t]));
  return reordered.map((o) => byId.get(o.id)!).filter(Boolean) as PlayerTrack[];
}

/**
 * Re-order the TAIL of a queue without moving the currently-playing track.
 * What's already played stays where it is; what's after the current track
 * gets re-ordered through `mode`.
 */
function reorderRemaining(
  queue: PlayerTrack[],
  currentIndex: number,
  mode: PlayMode,
  seed: number
): PlayerTrack[] {
  if (queue.length === 0) return queue;
  const safeIdx = Math.max(0, Math.min(currentIndex, queue.length - 1));
  const head = queue.slice(0, safeIdx + 1);
  const tail = queue.slice(safeIdx + 1);
  if (tail.length === 0) return queue.slice();
  return [...head, ...orderQueue(tail, mode, seed)];
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Initial state
  currentTrack: null,
  queue: [],
  sourceQueue: [],
  currentIndex: 0,
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  repeat: 'none',
  playMode: 'sequential',
  shuffle: false,

  // Play a single track. If a queue is supplied we honor the active mode.
  playTrack: (track, queue) => {
    const sourceQueue = queue || [track];
    const { playMode } = get();
    const ordered = orderQueue(sourceQueue, playMode, Date.now());
    const startIndex = ordered.findIndex((t) => t.id === track.id);
    set({
      currentTrack: track,
      queue: ordered,
      sourceQueue,
      currentIndex: startIndex >= 0 ? startIndex : 0,
      isPlaying: true,
      currentTime: 0,
    });
  },

  // Play a full queue starting at index. Optional `mode` overrides the active mode.
  playQueue: (queue, startIndex = 0, mode) => {
    if (queue.length === 0) return;
    const sourceQueue = queue.slice();
    const activeMode = mode ?? get().playMode;
    const startTrack = queue[startIndex];

    let ordered = orderQueue(sourceQueue, activeMode, Date.now());
    let resolvedIndex: number;

    if (activeMode === 'sequential') {
      resolvedIndex = startIndex;
    } else {
      // Keep the user's chosen "start track" actually first — clicking row 5
      // with smart-shuffle on shouldn't jump them somewhere unexpected.
      const startInOrdered = ordered.findIndex((t) => t.id === startTrack.id);
      if (startInOrdered > 0) {
        ordered = [
          ordered[startInOrdered],
          ...ordered.slice(0, startInOrdered),
          ...ordered.slice(startInOrdered + 1),
        ];
      }
      resolvedIndex = 0;
    }

    set({
      currentTrack: ordered[resolvedIndex],
      queue: ordered,
      sourceQueue,
      currentIndex: resolvedIndex,
      // If the caller passed a mode, persist it as the new active mode.
      playMode: activeMode,
      shuffle: activeMode !== 'sequential',
      isPlaying: true,
      currentTime: 0,
    });
  },

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setLoading: (loading) => set({ isLoading: loading }),

  next: () => {
    const { queue, currentIndex, repeat } = get();
    if (queue.length === 0) return;

    if (repeat === 'one') {
      // Replay current
      set({ currentTime: 0, isPlaying: true });
      return;
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex >= queue.length) {
      if (repeat === 'all') {
        // Loop back to start.
        set({
          currentTrack: queue[0],
          currentIndex: 0,
          currentTime: 0,
          isPlaying: true,
        });
        return;
      }
      // End of queue
      set({ isPlaying: false, currentTime: 0 });
      return;
    }

    set({
      currentTrack: queue[nextIndex],
      currentIndex: nextIndex,
      currentTime: 0,
      isPlaying: true,
    });
  },

  previous: () => {
    const { queue, currentIndex, currentTime } = get();
    if (queue.length === 0) return;

    // If more than 3 seconds played, restart current track
    if (currentTime > 3) {
      set({ currentTime: 0 });
      return;
    }

    const prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      set({ currentTime: 0 });
      return;
    }

    set({
      currentTrack: queue[prevIndex],
      currentIndex: prevIndex,
      currentTime: 0,
      isPlaying: true,
    });
  },

  seek: (time) => set({ currentTime: time }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),

  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ volume: clamped });
  },

  toggleRepeat: () =>
    set((state) => ({
      repeat:
        state.repeat === 'none'
          ? 'all'
          : state.repeat === 'all'
          ? 'one'
          : 'none',
    })),

  setPlayMode: (mode) => {
    const { queue, currentIndex, sourceQueue } = get();
    if (queue.length === 0) {
      // No active playback; just remember the choice for next playQueue().
      set({ playMode: mode, shuffle: mode !== 'sequential' });
      return;
    }

    if (mode === 'sequential') {
      // Re-derive from sourceQueue so the user sees the original order from
      // the current track forward, without rewinding what's been played.
      const currentId = queue[currentIndex]?.id;
      const inSource = sourceQueue.findIndex((t) => t.id === currentId);
      if (inSource < 0) {
        // Couldn't find current in source — fall back to keeping the queue.
        set({ playMode: mode, shuffle: false });
        return;
      }
      // Build: [...what's in queue up to currentIndex, ...rest of sourceQueue after current]
      const head = queue.slice(0, currentIndex + 1);
      const headIds = new Set(head.map((t) => t.id));
      const tail = sourceQueue.filter((t) => !headIds.has(t.id));
      set({
        playMode: 'sequential',
        shuffle: false,
        queue: [...head, ...tail],
        currentIndex,
      });
      return;
    }

    // Switching to a non-sequential mode → re-order what comes after the
    // currently playing track using the new mode.
    const reordered = reorderRemaining(queue, currentIndex, mode, Date.now());
    set({
      playMode: mode,
      shuffle: true,
      queue: reordered,
      currentIndex,
    });
  },

  toggleShuffle: () => {
    const { playMode } = get();
    // Two-state legacy toggle: sequential ↔ smart-shuffle.
    const next: PlayMode =
      playMode === 'sequential' ? 'smart-shuffle' : 'sequential';
    get().setPlayMode(next);
  },

  clearPlayer: () =>
    set({
      currentTrack: null,
      queue: [],
      sourceQueue: [],
      currentIndex: 0,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    }),
}));
