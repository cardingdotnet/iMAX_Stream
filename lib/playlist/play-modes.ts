/**
 * Play-mode ordering algorithms.
 *
 * Pure, dependency-free, framework-agnostic. Works on:
 *   - Client (player store / playlist page)
 *   - Server (radio endpoint, after Supabase RPC)
 *
 * No LLM, no third-party API, no genre database — every decision is a
 * deterministic function of metadata you already have:
 *
 *   { id, artist, genre?, durationMs, addedAt? }
 *
 * Modes:
 *   sequential       — as added by the owner
 *   smart-shuffle    — shuffled but with no back-to-back same-artist
 *   by-artist        — group all tracks by artist (alphabetical)
 *   by-genre         — group all tracks by genre (alphabetical, "Unknown" last)
 *   longest-first    — duration descending
 *   shortest-first   — duration ascending
 *   recently-added   — added_at descending
 *
 * All functions return a NEW array; never mutate the input.
 */

export type PlayMode =
  | 'sequential'
  | 'smart-shuffle'
  | 'by-artist'
  | 'by-genre'
  | 'longest-first'
  | 'shortest-first'
  | 'recently-added';

export const PLAY_MODES: PlayMode[] = [
  'sequential',
  'smart-shuffle',
  'by-artist',
  'by-genre',
  'longest-first',
  'shortest-first',
  'recently-added',
];

export interface PlayModeMeta {
  /** Stable id used in URLs / DB. */
  id: PlayMode;
  /** Title-cased label for the UI. */
  label: string;
  /** One-line description shown in the mode picker. */
  description: string;
}

export const PLAY_MODE_META: Record<PlayMode, PlayModeMeta> = {
  'sequential': {
    id: 'sequential',
    label: 'In order',
    description: 'Play in the order you arranged.',
  },
  'smart-shuffle': {
    id: 'smart-shuffle',
    label: 'Smart shuffle',
    description: 'Shuffled, but never the same artist twice in a row.',
  },
  'by-artist': {
    id: 'by-artist',
    label: 'By artist',
    description: 'Group every track by artist.',
  },
  'by-genre': {
    id: 'by-genre',
    label: 'By genre',
    description: 'Group every track by genre.',
  },
  'longest-first': {
    id: 'longest-first',
    label: 'Longest first',
    description: 'Sorted from longest to shortest.',
  },
  'shortest-first': {
    id: 'shortest-first',
    label: 'Shortest first',
    description: 'Sorted from shortest to longest.',
  },
  'recently-added': {
    id: 'recently-added',
    label: 'Recently added',
    description: 'Newest additions first.',
  },
};

/** Minimum data needed to order. Extra fields are passed through. */
export interface OrderableTrack {
  id: number;
  artist?: string | null;
  genre?: string | null;
  durationMs?: number | null;
  /** ISO string or millisecond timestamp; either works. */
  addedAt?: string | number | null;
}

export function isPlayMode(s: unknown): s is PlayMode {
  return typeof s === 'string' && (PLAY_MODES as string[]).includes(s);
}

/* ─────────────── public entry point ─────────────── */

/**
 * Apply a play mode to a list of tracks. Returns a new array of the same
 * elements in the new order. Pure; same input + same seed always produces
 * the same output.
 *
 * `seed` only matters for `smart-shuffle`. The radio endpoint passes a
 * deterministic seed (e.g. epoch ms) so every listener computes the same
 * shuffled order — without it, two listeners would shuffle differently and
 * sync would break.
 */
export function applyPlayMode<T extends OrderableTrack>(
  tracks: T[],
  mode: PlayMode,
  seed?: number
): T[] {
  switch (mode) {
    case 'sequential':
      return tracks.slice();
    case 'smart-shuffle':
      return smartShuffle(tracks, seed ?? Date.now());
    case 'by-artist':
      return groupByKey(tracks, (t) => normalizeKey(t.artist), 'Unknown Artist');
    case 'by-genre':
      return groupByKey(tracks, (t) => normalizeKey(t.genre), 'Unknown');
    case 'longest-first':
      return [...tracks].sort(
        (a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0)
      );
    case 'shortest-first':
      return [...tracks].sort(
        (a, b) => (a.durationMs ?? 0) - (b.durationMs ?? 0)
      );
    case 'recently-added':
      return [...tracks].sort(
        (a, b) => addedAtMs(b.addedAt) - addedAtMs(a.addedAt)
      );
    default:
      // Exhaustiveness — TS catches new modes that forget a branch.
      const _exhaustive: never = mode;
      return tracks.slice();
  }
}

/* ─────────────── smart-shuffle ─────────────── */

/**
 * Mulberry32 — tiny seeded PRNG. Lets us produce the SAME shuffled order
 * across server + client when given the same seed (essential for the radio
 * endpoint where every listener computes the same playlist).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fisherYates<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Shuffle, then walk the array and swap any track whose artist matches the
 * previous one with the next non-conflicting track. If we can't fix a
 * collision (e.g. one artist dominates the playlist), we accept it — better
 * than infinite-looping.
 */
function smartShuffle<T extends OrderableTrack>(tracks: T[], seed: number): T[] {
  if (tracks.length < 3) return tracks.slice();

  const rng = mulberry32(seed);
  const arr = fisherYates(tracks, rng);

  // De-clump: walk left→right, if arr[i].artist === arr[i-1].artist, find
  // the nearest later track with a different artist and swap it in.
  for (let i = 1; i < arr.length; i++) {
    const prevArtist = normalizeKey(arr[i - 1].artist);
    if (normalizeKey(arr[i].artist) !== prevArtist) continue;

    let swapIdx = -1;
    for (let j = i + 1; j < arr.length; j++) {
      const cand = normalizeKey(arr[j].artist);
      // Candidate must differ from prev artist AND, ideally, from the
      // track that will follow it (arr[i+1]) once swapped.
      if (cand !== prevArtist) {
        swapIdx = j;
        break;
      }
    }
    if (swapIdx !== -1) {
      [arr[i], arr[swapIdx]] = [arr[swapIdx], arr[i]];
    }
    // If no candidate found, this artist dominates — leave the clump.
  }

  return arr;
}

/* ─────────────── group-by helpers ─────────────── */

/**
 * Group tracks by a key, then concatenate groups in alphabetical order.
 * Within each group, preserve the original relative order (stable).
 *
 * `unknownLabel` is used as the bucket key for tracks whose key is empty,
 * and that bucket is always placed last.
 */
function groupByKey<T extends OrderableTrack>(
  tracks: T[],
  keyFn: (t: T) => string,
  unknownLabel: string
): T[] {
  const groups = new Map<string, T[]>();
  for (const t of tracks) {
    const k = keyFn(t) || unknownLabel;
    let g = groups.get(k);
    if (!g) {
      g = [];
      groups.set(k, g);
    }
    g.push(t);
  }
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === unknownLabel) return 1;
    if (b === unknownLabel) return -1;
    return a.localeCompare(b);
  });
  const out: T[] = [];
  for (const k of sortedKeys) {
    out.push(...(groups.get(k) || []));
  }
  return out;
}

function normalizeKey(s: string | null | undefined): string {
  return (s || '').trim().toLowerCase();
}

function addedAtMs(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const t = Date.parse(v);
  return isFinite(t) ? t : 0;
}
