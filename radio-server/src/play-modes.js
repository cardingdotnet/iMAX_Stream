/**
 * Play-mode ordering — JS port of lib/playlist/play-modes.ts.
 * Kept in sync manually; if you change one, change both.
 *
 * Why duplicated and not imported: this server is a standalone Node
 * deployment (Fly.io) that doesn't share the Next.js app's tsconfig or
 * build tooling. A plain JS copy keeps the deployment minimal — no TS
 * compilation step, no path-alias resolution, no node_modules bloat.
 */

const PLAY_MODES = [
  'sequential',
  'smart-shuffle',
  'by-artist',
  'by-genre',
  'longest-first',
  'shortest-first',
  'recently-added',
];

function isPlayMode(s) {
  return typeof s === 'string' && PLAY_MODES.includes(s);
}

function applyPlayMode(tracks, mode, seed) {
  switch (mode) {
    case 'sequential':
      return tracks.slice();
    case 'smart-shuffle':
      return smartShuffle(tracks, seed != null ? seed : Date.now());
    case 'by-artist':
      return groupByKey(tracks, (t) => normalizeKey(t.artist), 'Unknown Artist');
    case 'by-genre':
      return groupByKey(tracks, (t) => normalizeKey(t.genre), 'Unknown');
    case 'longest-first':
      return tracks.slice().sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0));
    case 'shortest-first':
      return tracks.slice().sort((a, b) => (a.durationMs || 0) - (b.durationMs || 0));
    case 'recently-added':
      return tracks.slice().sort((a, b) => addedAtMs(b.addedAt) - addedAtMs(a.addedAt));
    default:
      return tracks.slice();
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fisherYates(arr, rng) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function smartShuffle(tracks, seed) {
  if (tracks.length < 3) return tracks.slice();
  const rng = mulberry32(seed);
  const arr = fisherYates(tracks, rng);
  for (let i = 1; i < arr.length; i++) {
    const prevArtist = normalizeKey(arr[i - 1].artist);
    if (normalizeKey(arr[i].artist) !== prevArtist) continue;
    let swapIdx = -1;
    for (let j = i + 1; j < arr.length; j++) {
      if (normalizeKey(arr[j].artist) !== prevArtist) {
        swapIdx = j;
        break;
      }
    }
    if (swapIdx !== -1) {
      const tmp = arr[i];
      arr[i] = arr[swapIdx];
      arr[swapIdx] = tmp;
    }
  }
  return arr;
}

function groupByKey(tracks, keyFn, unknownLabel) {
  const groups = new Map();
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
  const out = [];
  for (const k of sortedKeys) {
    out.push(...(groups.get(k) || []));
  }
  return out;
}

function normalizeKey(s) {
  return ((s == null ? '' : String(s)).trim()).toLowerCase();
}

function addedAtMs(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const t = Date.parse(v);
  return isFinite(t) ? t : 0;
}

module.exports = { applyPlayMode, isPlayMode, PLAY_MODES };
