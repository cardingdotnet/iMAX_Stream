/**
 * IMVU-Compatible Radio Endpoint — SHARED BROADCAST TIMELINE
 *
 * URL: /radio/{code}.mp3
 *
 * Behaves like an Icecast radio station: every listener connected to the
 * same {code} hears the same audio at the same wall-clock instant. A late
 * joiner does NOT start at track 1; they drop into whatever is playing
 * *right now*, mid-track if necessary. The playlist loops forever.
 *
 * ───────────── HOW THE TIMELINE WORKS ─────────────
 *
 * The first listener to ever connect to a given {code} writes a single
 * `broadcast_started_at` timestamp (the "epoch") into the playlists row,
 * via the atomic `start_broadcast_if_unset` RPC. Every subsequent listener
 * reads that same epoch and computes:
 *
 *     elapsedMs       = now() - epoch
 *     elapsedInLoopMs = elapsedMs % totalPlaylistDurationMs
 *     → walk track durations until we find the current track + offset
 *
 * Because the math is deterministic and stateless, this works on serverless
 * (each request computes the same answer independently — no central process
 * holding state, no Redis, no in-memory broadcast bus).
 *
 * ───────────── HOW MID-TRACK JOINS WORK ─────────────
 *
 * Once we know "current track + 47000ms in," we start streaming that track
 * from the right point:
 *
 *   - Progressive MP3 → HTTP Range request, byte offset estimated from the
 *     track's bitrate (content_length ÷ duration × offset_seconds). Slight
 *     VBR drift is acceptable for an IMVU room radio (<1s typically).
 *
 *   - HLS → parse the manifest, sum #EXTINF durations until we cross the
 *     offset, start from that segment. Segment-level granularity (2–6s);
 *     listener may start a fraction of a second early or late — fine.
 *
 * ───────────── WHY WE PACE THE OUTPUT ─────────────
 *
 * We THROTTLE outgoing bytes to ~track-bitrate. If we just dumped data as
 * fast as SoundCloud's CDN serves it, the listener's player would buffer
 * minutes ahead of the wall-clock timeline — then the *next* listener who
 * joins would compute a different "now" position than what the first
 * listener is hearing. By pacing at real-time speed, the bytes leaving our
 * server roughly track wall-clock, and synchronisation holds.
 *
 * This is what real Icecast servers do; it's not optional for sync.
 *
 * ───────────── WHAT WE DROPPED ─────────────
 *
 * The previous per-listener `listenerCursor` resume logic is GONE. With a
 * shared timeline, "resume on reconnect" *is* "rejoin the broadcast at
 * wall-clock now" — it falls out for free. Simpler and more correct.
 *
 * ───────────── HOSTING NOTE ─────────────
 *
 * Vercel Serverless still has a hard execution-time cap. When it kicks in,
 * the response is killed mid-stream and IMVU reconnects. Each reconnect
 * computes the live position fresh, so listeners DON'T restart at track 1 —
 * they drop into wherever the timeline is at that moment. The only
 * remaining artefact is a brief audio gap during the reconnect (tens of ms
 * to a couple of seconds depending on the player). For seamless playback
 * use a host that supports long-lived responses (Fly.io, Railway, Render,
 * a VPS, or a Cloudflare Worker).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { getSoundCloudClient, Mp3StreamSource } from '@/lib/soundcloud/client';
import {
  applyPlayMode,
  isPlayMode,
  PlayMode,
} from '@/lib/playlist/play-modes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// NOTE: maxDuration deliberately NOT set. The default on Vercel is the
// platform tier's max; on long-running hosts (Fly/Railway/VPS) there is no
// limit. Don't reintroduce this — it caps the stream length artificially.

interface PlaylistRow {
  playlist_id: string;
  playlist_name: string;
  playlist_short_code: string;
  user_id: string;
  track_id: number;
  track_title: string;
  track_artist: string;
  track_duration_ms: number;
  track_position: number;
  /** SoundCloud genre, may be null. Used by play-mode = 'by-genre'. */
  track_genre: string | null;
  /** ISO timestamp; null if the broadcast hasn't started yet. */
  broadcast_started_at: string | null;
  /** Owner's chosen ordering for the broadcast. Defaults to 'sequential'. */
  default_play_mode: string;
}

const RADIO_HEADERS = {
  'Content-Type': 'audio/mpeg',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Access-Control-Allow-Origin': '*',
  Connection: 'close',
  'icy-pub': '0',
  'X-Accel-Buffering': 'no',
};

const SC_FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: '*/*',
  Referer: 'https://soundcloud.com/',
  Origin: 'https://soundcloud.com',
};

/** How many HLS segments to fetch in parallel ahead of the playhead. */
const HLS_PREFETCH = 3;

/** Assumed bitrate when we can't infer one from a Content-Length header.
 *  128kbps is what SoundCloud's MP3 transcodings use in practice. */
const ASSUMED_BITRATE_KBPS = 128;
const ASSUMED_BYTES_PER_SEC = (ASSUMED_BITRATE_KBPS * 1000) / 8; // 16000 B/s

/* ─────────────── Playlist row cache ─────────────── */
const PLAYLIST_TTL_MS = 30 * 1000;
const playlistCache = new Map<
  string,
  { rows: PlaylistRow[]; expiresAt: number }
>();

function getCachedPlaylist(code: string): PlaylistRow[] | null {
  const e = playlistCache.get(code);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    playlistCache.delete(code);
    return null;
  }
  return e.rows;
}

function setCachedPlaylist(code: string, rows: PlaylistRow[]): void {
  if (playlistCache.size > 1000) {
    const firstKey = playlistCache.keys().next().value;
    if (firstKey !== undefined) playlistCache.delete(firstKey);
  }
  playlistCache.set(code, { rows, expiresAt: Date.now() + PLAYLIST_TTL_MS });
}

/* ─────────────── Timeline math ─────────────── */

interface TimelinePosition {
  /** 0-based index into trackIds. */
  trackIndex: number;
  /** Milliseconds INTO the current track. */
  offsetMs: number;
}

/**
 * Given the broadcast epoch, the track durations, and "now," figure out which
 * track should be playing and how far into it we are. Pure function — same
 * inputs always give the same answer.
 */
function computeTimelinePosition(
  epochMs: number,
  nowMs: number,
  durationsMs: number[]
): TimelinePosition {
  const total = durationsMs.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    return { trackIndex: 0, offsetMs: 0 };
  }
  // Guard against clock drift / pre-epoch joins.
  const elapsedRaw = nowMs - epochMs;
  const elapsed = elapsedRaw < 0 ? 0 : elapsedRaw;
  let inLoop = elapsed % total;

  for (let i = 0; i < durationsMs.length; i++) {
    const d = durationsMs[i];
    if (d <= 0) continue;
    if (inLoop < d) {
      return { trackIndex: i, offsetMs: inLoop };
    }
    inLoop -= d;
  }
  // Numerical edge case (shouldn't happen with positive durations).
  return { trackIndex: 0, offsetMs: 0 };
}

/* ─────────────── Pacing helpers ─────────────── */

/**
 * Real-time pacer. Tracks how many bytes we've emitted at a target rate and
 * stalls (await sleep) whenever we're ahead of wall-clock. This is what keeps
 * all listeners on the same timeline — without this, fast CDN delivery would
 * push our stream minutes ahead of the broadcast clock.
 */
class BytePacer {
  private startedAt = Date.now();
  private bytesSent = 0;
  private bytesPerSec: number;

  constructor(bytesPerSec: number) {
    this.bytesPerSec = Math.max(1, bytesPerSec);
  }

  /** Reset the clock; called at each track boundary so transitions don't accrue lag. */
  reset(initialBytes = 0, initialOffsetMs = 0): void {
    this.bytesSent = initialBytes;
    // Pretend the pacer started `initialOffsetMs` ago — i.e. we already "owe"
    // the listener that much real time when joining mid-track.
    this.startedAt = Date.now() - initialOffsetMs;
  }

  setRate(bytesPerSec: number): void {
    this.bytesPerSec = Math.max(1, bytesPerSec);
  }

  /**
   * Account for `n` bytes about to be sent and sleep if we're ahead of
   * real-time. Returns once it's OK to actually emit them.
   */
  async account(n: number, signal: AbortSignal): Promise<void> {
    this.bytesSent += n;
    const targetMs = (this.bytesSent / this.bytesPerSec) * 1000;
    const elapsedMs = Date.now() - this.startedAt;
    const aheadMs = targetMs - elapsedMs;
    if (aheadMs > 5) {
      // 5ms slack to avoid death-by-a-thousand-tiny-sleeps.
      await sleep(aheadMs, signal);
    }
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve();
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/* ─────────────── Listener fingerprint (logging only) ─────────────── */

async function listenerKey(code: string, request: NextRequest): Promise<string> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';
  const uaCoarse = ua.substring(0, 40);
  const raw = `${code}|${ip}|${uaCoarse}`;
  return `${code}:${await sha256(raw)}`;
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 24);
}

/* ─────────────── Main handler ─────────────── */

/**
 * Optional: if RADIO_BASE_URL is set, redirect listeners to a dedicated
 * radio host (e.g. Fly.io) instead of streaming from this Next.js server.
 *
 * This is the production setup on Cloudflare Pages, where Workers cap each
 * request at 30s/5min and can't host a long-lived audio stream. The main
 * app stays on Cloudflare; only this endpoint redirects to Fly.
 *
 * IMVU's MP3 player follows 302 redirects normally, so this is invisible
 * to the listener. If RADIO_BASE_URL is unset, the route streams locally
 * (the original behavior — fine on Fly/Railway/Render/VPS).
 */
const RADIO_BASE_URL = process.env.RADIO_BASE_URL?.replace(/\/+$/, '') || '';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await params;
  const code = rawCode.replace(/\.(mp3|m3u|pls)$/i, '').toLowerCase();

  // Cloudflare Pages → Fly.io radio. Use 302 (temporary) so any future
  // change of host doesn't get cached by intermediate proxies.
  if (RADIO_BASE_URL) {
    const target = `${RADIO_BASE_URL}/radio/${encodeURIComponent(code)}.mp3`;
    return NextResponse.redirect(target, 302);
  }

  if (!code || code.length < 1) {
    return new NextResponse('Invalid radio URL', { status: 400 });
  }

  // ─── Load playlist (cache first, then Supabase) ───
  let rows = getCachedPlaylist(code);
  if (!rows) {
    const supabase = createAdminSupabaseClient();
    const { data: rawRows, error } = await supabase.rpc(
      'get_playlist_by_short_code',
      { p_code: code }
    );
    if (error) {
      console.error('[radio] DB error:', error);
      return new NextResponse('Failed to load playlist', { status: 500 });
    }
    rows = (rawRows ?? []) as PlaylistRow[];
    if (rows.length > 0) setCachedPlaylist(code, rows);
  }
  if (rows.length === 0) {
    return new NextResponse(`Radio not found: ${code}`, { status: 404 });
  }

  const playlistName = rows[0].playlist_name;
  const playlistId = rows[0].playlist_id;

  // ─── Establish or read the broadcast epoch ───
  // We need the epoch BEFORE we order tracks because the epoch is also the
  // shuffle seed — every listener must compute the same shuffled order, so
  // the only safe seed is one that's persisted and identical for everyone.
  let epochIso = rows[0].broadcast_started_at;
  if (!epochIso) {
    // First listener ever — claim the epoch atomically.
    const supabase = createAdminSupabaseClient();
    const { data: claimed, error: claimErr } = await supabase.rpc(
      'start_broadcast_if_unset',
      { p_code: code }
    );
    if (claimErr) {
      console.error('[radio] start_broadcast_if_unset error:', claimErr);
      // Fall back to "now" — slightly worse sync but the stream still works.
      epochIso = new Date().toISOString();
    } else {
      epochIso = claimed as string;
    }
    // Bust the playlist cache so the next request sees the new epoch without waiting for TTL.
    playlistCache.delete(code);
    if (rows.length > 0) {
      const updated = rows.map((r) => ({ ...r, broadcast_started_at: epochIso }));
      setCachedPlaylist(code, updated);
    }
  }
  const epochMs = epochIso ? Date.parse(epochIso) : Date.now();

  // ─── Apply the playlist's default play mode to derive the track order ───
  // The mode determines what listeners hear; the epoch is used as the seed
  // for any randomness, so two listeners on the same broadcast compute the
  // exact same playlist order without needing to share state.
  //
  // If the owner ever changes the mode (via set_default_play_mode), the
  // epoch is reset to NULL by that RPC, and the next listener to connect
  // claims a fresh epoch — giving everyone a clean restart in the new order.
  const rawMode = rows[0].default_play_mode || 'sequential';
  const mode: PlayMode = isPlayMode(rawMode) ? rawMode : 'sequential';

  const orderable = rows.map((r) => ({
    id: r.track_id,
    artist: r.track_artist,
    genre: r.track_genre,
    durationMs: r.track_duration_ms,
    addedAt: r.track_position, // Use position as the "added" proxy since we don't track added_at on the radio
  }));
  const ordered = applyPlayMode(orderable, mode, epochMs);
  const trackIds = ordered.map((o) => o.id);
  const durationsMs = ordered.map((o) => o.durationMs ?? 0);

  // ─── Compute "where on the timeline am I joining?" ───
  const start = computeTimelinePosition(epochMs, Date.now(), durationsMs);

  const lkey = await listenerKey(code, request);
  console.log(
    `[radio] ${code} -> "${playlistName}" (${trackIds.length} tracks, mode=${mode}). ` +
    `epoch=${epochIso} join@track=${start.trackIndex} offset=${start.offsetMs}ms ` +
    `lkey=${lkey.substring(0, 12)} ` +
    `UA="${(request.headers.get('user-agent') || '').substring(0, 60)}"`
  );

  // Fire-and-forget logging (never blocks the stream)
  logRadioAccess(code, request).catch((e) =>
    console.error('[radio] log failed:', e)
  );
  incrementPlayCount(playlistId).catch((e) =>
    console.error('[radio] play_count failed:', e)
  );

  const sc = getSoundCloudClient();
  const abortController = new AbortController();

  request.signal.addEventListener('abort', () => {
    console.log(`[radio] ${code} client disconnected`);
    abortController.abort();
  });

  // Pre-warm the first track resolution.
  const firstResolvePromise = sc.resolveMp3Stream(trackIds[start.trackIndex]);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let trackIndex = start.trackIndex;
      let initialOffsetMs = start.offsetMs;
      let consecutiveFailures = 0;
      const MAX_CONSECUTIVE_FAILURES = trackIds.length * 2;

      // Pacer — set to default rate; refined per-track once we learn the real bitrate.
      const pacer = new BytePacer(ASSUMED_BYTES_PER_SEC);

      let nextTrackPromise: Promise<Mp3StreamSource | null> | null =
        firstResolvePromise;

      while (!abortController.signal.aborted) {
        const trackId = trackIds[trackIndex % trackIds.length];

        let mp3: Mp3StreamSource | null = null;
        try {
          mp3 = await (nextTrackPromise || sc.resolveMp3Stream(trackId));
        } catch (e) {
          console.error(`[radio] ${code} resolve failed track ${trackId}:`, e);
        }

        // Pre-resolve the next track in the background.
        const nextIdx = (trackIndex + 1) % trackIds.length;
        nextTrackPromise = sc
          .resolveMp3Stream(trackIds[nextIdx])
          .catch((e) => {
            console.error(`[radio] prefetch track ${trackIds[nextIdx]}:`, e);
            return null;
          });

        if (!mp3) {
          consecutiveFailures++;
          console.warn(
            `[radio] ${code} skip track ${trackId} (no MP3). ` +
            `failures=${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}`
          );
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.error(`[radio] ${code} too many failures, ending stream`);
            try {
              controller.close();
            } catch {}
            return;
          }
          // Skip the bad track AND realign to wall-clock — even unplayable
          // tracks consume their slot in the loop, and resolving may have
          // taken non-trivial wall-clock time.
          const fix = computeTimelinePosition(epochMs, Date.now(), durationsMs);
          trackIndex = fix.trackIndex;
          initialOffsetMs = fix.offsetMs;
          continue;
        }
        consecutiveFailures = 0;

        // Reset pacer at each track boundary, accounting for our mid-track offset.
        // This is what keeps a late joiner aligned: the pacer pretends it
        // started `initialOffsetMs` ago so it doesn't try to deliver the
        // "missed" portion in a burst.
        pacer.reset(0, initialOffsetMs);

        try {
          if (mp3.type === 'progressive') {
            await pipeProgressivePaced(
              mp3.url,
              controller,
              abortController.signal,
              pacer,
              initialOffsetMs,
              durationsMs[trackIndex % durationsMs.length] || 0
            );
          } else {
            await pipeHlsParallelPaced(
              mp3.url,
              controller,
              abortController.signal,
              pacer,
              initialOffsetMs
            );
          }
        } catch (e: any) {
          if (
            abortController.signal.aborted ||
            e?.name === 'AbortError' ||
            e?.code === 'ERR_INVALID_STATE'
          ) {
            return;
          }
          console.error(
            `[radio] ${code} stream error track ${trackId}:`,
            e?.message || e
          );
        }

        // After the first (mid-track) song completes, all subsequent songs
        // play from the start.
        initialOffsetMs = 0;
        trackIndex++;
      }

      try {
        controller.close();
      } catch {}
    },
    cancel() {
      abortController.abort();
    },
  });

  const safeName = sanitizeIcyName(playlistName);

  return new NextResponse(stream as any, {
    status: 200,
    headers: {
      ...RADIO_HEADERS,
      'icy-name': safeName,
      'icy-genre': 'Various',
      'icy-description': `EgMax radio · ${safeName}`,
      'icy-br': String(ASSUMED_BITRATE_KBPS),
    },
  });
}

export async function HEAD(
  _request: NextRequest,
  _ctx: { params: Promise<{ code: string }> }
) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...RADIO_HEADERS,
      'icy-name': 'EgMax Radio',
      'icy-br': String(ASSUMED_BITRATE_KBPS),
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Icy-MetaData, Range',
    },
  });
}

/* ─────────────── progressive piping (with mid-track join + pacing) ─────────────── */

/**
 * Pipe a progressive MP3 through the pacer, optionally starting `offsetMs`
 * into the track via an HTTP Range request.
 *
 * Bitrate strategy:
 *   - We do a HEAD (cheap) to get Content-Length.
 *   - If we have it AND track duration, real bitrate = bytes ÷ seconds. We
 *     update the pacer rate so output paces match the actual track, not
 *     our 128kbps assumption.
 *   - If we don't, fall back to ASSUMED_BYTES_PER_SEC.
 *   - Byte offset for mid-track join = bitrate × offset_seconds. VBR may
 *     drift but is fine for room radio.
 */
async function pipeProgressivePaced(
  url: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  signal: AbortSignal,
  pacer: BytePacer,
  offsetMs: number,
  trackDurationMs: number
): Promise<void> {
  let bytesPerSec = ASSUMED_BYTES_PER_SEC;
  let totalBytes = 0;

  // Probe Content-Length (HEAD is cheap; SoundCloud CDN supports it).
  try {
    const head = await fetch(url, { method: 'HEAD', headers: SC_FETCH_HEADERS, signal });
    const cl = head.headers.get('content-length');
    if (cl) {
      const n = parseInt(cl, 10);
      if (n > 0) {
        totalBytes = n;
        if (trackDurationMs > 0) {
          bytesPerSec = (n * 1000) / trackDurationMs;
          pacer.setRate(bytesPerSec);
        }
      }
    }
  } catch {
    // Non-fatal — fall through with assumed rate.
  }

  // Compute byte offset for mid-track join. Clamp to [0, totalBytes-1].
  let byteOffset = 0;
  if (offsetMs > 0) {
    byteOffset = Math.floor((offsetMs / 1000) * bytesPerSec);
    if (totalBytes > 0 && byteOffset >= totalBytes) {
      // Offset overshoots the file — already past the end. Skip the track.
      return;
    }
  }

  const reqHeaders: Record<string, string> = { ...SC_FETCH_HEADERS };
  if (byteOffset > 0) {
    reqHeaders['Range'] = `bytes=${byteOffset}-`;
  }

  const res = await fetch(url, { headers: reqHeaders, signal });
  if (!res.ok || !res.body) {
    // 416 (Range Not Satisfiable) or similar — try without Range as fallback.
    if (byteOffset > 0 && (res.status === 416 || res.status === 400)) {
      const fallback = await fetch(url, { headers: SC_FETCH_HEADERS, signal });
      if (!fallback.ok || !fallback.body) {
        throw new Error(`progressive fetch ${fallback.status}`);
      }
      // No range — but we still need to honor the wall-clock offset, so the
      // pacer (already reset with offsetMs) will throttle from byte 0 as if
      // the track started offsetMs ago. That keeps wall-clock alignment but
      // causes the listener to hear extra audio at the start. Mid-track join
      // is best-effort when Range isn't supported.
      await drainBodyPaced(fallback.body, controller, signal, pacer);
      return;
    }
    throw new Error(`progressive fetch ${res.status}`);
  }

  await drainBodyPaced(res.body, controller, signal, pacer);
}

async function drainBodyPaced(
  body: ReadableStream<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
  signal: AbortSignal,
  pacer: BytePacer
): Promise<void> {
  const reader = body.getReader();
  while (true) {
    if (signal.aborted) {
      try { await reader.cancel(); } catch {}
      return;
    }
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.byteLength > 0) {
      // Pace BEFORE enqueue so we never burst ahead of wall-clock.
      await pacer.account(value.byteLength, signal);
      if (signal.aborted) {
        try { await reader.cancel(); } catch {}
        return;
      }
      try {
        controller.enqueue(value);
      } catch {
        try { await reader.cancel(); } catch {}
        return;
      }
    }
  }
}

/* ─────────────── HLS piping (segment-level mid-track join + pacing) ─────────────── */

interface HlsSegment {
  url: string;
  durationSec: number;
}

async function pipeHlsParallelPaced(
  manifestUrl: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  signal: AbortSignal,
  pacer: BytePacer,
  offsetMs: number
): Promise<void> {
  const manifestRes = await fetch(manifestUrl, { headers: SC_FETCH_HEADERS, signal });
  if (!manifestRes.ok) {
    throw new Error(`hls manifest fetch ${manifestRes.status}`);
  }
  const manifestText = await manifestRes.text();
  const segments = parseM3u8SegmentsWithDurations(manifestText, manifestUrl);
  if (segments.length === 0) {
    throw new Error('hls manifest: no segments');
  }

  // Find the segment that contains offsetMs (segment-level granularity).
  let startSegIdx = 0;
  if (offsetMs > 0) {
    let acc = 0;
    let found = false;
    for (let i = 0; i < segments.length; i++) {
      const segMs = segments[i].durationSec * 1000;
      if (acc + segMs > offsetMs) {
        startSegIdx = i;
        found = true;
        break;
      }
      acc += segMs;
    }
    if (!found) {
      // Offset past the track — skip.
      return;
    }
  }

  const fetchSegment = async (segUrl: string): Promise<Uint8Array | null> => {
    if (signal.aborted) return null;
    try {
      const res = await fetch(segUrl, { headers: SC_FETCH_HEADERS, signal });
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      return null;
    }
  };

  const remaining = segments.slice(startSegIdx);

  const queue: Array<Promise<Uint8Array | null>> = [];
  for (let i = 0; i < Math.min(HLS_PREFETCH, remaining.length); i++) {
    queue.push(fetchSegment(remaining[i].url));
  }
  let nextToFetch = queue.length;

  for (let played = 0; played < remaining.length; played++) {
    if (signal.aborted) return;

    const buf = await queue.shift()!;
    if (nextToFetch < remaining.length) {
      queue.push(fetchSegment(remaining[nextToFetch++].url));
    }

    if (!buf || buf.byteLength === 0) continue;

    // Refine pacer rate on the first real segment we receive: bytes per
    // second of audio = segment_bytes ÷ segment_duration_sec. Handles
    // tracks at non-128k bitrates.
    if (played === 0 && remaining[0].durationSec > 0) {
      const inferred = buf.byteLength / remaining[0].durationSec;
      if (isFinite(inferred) && inferred > 1000) {
        pacer.setRate(inferred);
      }
    }

    await pacer.account(buf.byteLength, signal);
    if (signal.aborted) {
      await Promise.allSettled(queue);
      return;
    }

    try {
      controller.enqueue(buf);
    } catch {
      await Promise.allSettled(queue);
      return;
    }
  }
}

function parseM3u8SegmentsWithDurations(
  text: string,
  baseUrl: string
): HlsSegment[] {
  const out: HlsSegment[] = [];
  const lines = text.split(/\r?\n/);
  let pendingDuration = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
      // #EXTINF:6.000,
      const m = line.match(/^#EXTINF:([\d.]+)/);
      pendingDuration = m ? parseFloat(m[1]) : 0;
      continue;
    }
    if (line.startsWith('#')) continue;
    try {
      out.push({
        url: new URL(line, baseUrl).toString(),
        durationSec: pendingDuration,
      });
    } catch {
      // ignore
    }
    pendingDuration = 0;
  }
  return out;
}

function sanitizeIcyName(name: string): string {
  return (name || 'EgMax Radio')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[\r\n]/g, ' ')
    .trim()
    .substring(0, 80) || 'EgMax Radio';
}

async function logRadioAccess(code: string, request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient();
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const ipHash = await sha256(ip);
    await supabase.from('stream_access_logs').insert({
      stream_token: code,
      user_agent: ('[radio] ' + userAgent).substring(0, 500),
      ip_hash: ipHash,
    });
  } catch (e) {
    console.error('[radio] logRadioAccess error:', e);
  }
}

async function incrementPlayCount(playlistId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: current } = await supabase
    .from('playlists')
    .select('play_count')
    .eq('id', playlistId)
    .single();
  if (current) {
    await supabase
      .from('playlists')
      .update({ play_count: (current.play_count || 0) + 1 })
      .eq('id', playlistId);
  }
}
