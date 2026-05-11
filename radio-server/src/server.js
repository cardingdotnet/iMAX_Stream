/**
 * EgMax Radio Server — Standalone
 *
 * Hosts ONLY the /radio/{code}.mp3 endpoint. Designed for long-lived HTTP
 * responses (Fly.io, Railway, Render, VPS) where serverless platforms fall
 * down. The rest of the EgMax app runs on Cloudflare Pages.
 *
 * What this server does:
 *   GET  /radio/{code}.mp3   — synchronized broadcast stream (Icecast-style)
 *   GET  /healthz            — liveness probe for Fly.io
 *
 * Streaming behavior identical to the Next.js route in the main app:
 *   - First listener atomically claims the broadcast epoch via the
 *     start_broadcast_if_unset RPC.
 *   - Every subsequent listener computes the same wall-clock position
 *     from the same epoch — late joiners hear what's currently playing,
 *     mid-track if needed, in sync with everyone else.
 *   - Output is paced to the track's real bitrate so the byte stream
 *     tracks wall-clock (without this, listeners drift apart).
 *   - Mid-track joins use HTTP Range (progressive) or HLS segment seeking.
 */

'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { createClient } = require('@supabase/supabase-js');

const { getSoundCloudClient, DEFAULT_HEADERS: SC_FETCH_HEADERS } = require('./soundcloud');
const { applyPlayMode, isPlayMode } = require('./play-modes');

/* ─────────────── config ─────────────── */

const PORT = Number(process.env.PORT) || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[boot] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Set them via `fly secrets set` before deploying.'
  );
  process.exit(1);
}
if (!process.env.SOUNDCLOUD_CLIENT_ID) {
  console.error('[boot] Missing SOUNDCLOUD_CLIENT_ID');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ─────────────── constants ─────────────── */

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

const HLS_PREFETCH = 3;
const ASSUMED_BITRATE_KBPS = 128;
const ASSUMED_BYTES_PER_SEC = (ASSUMED_BITRATE_KBPS * 1000) / 8;

/* ─────────────── caches ─────────────── */

const PLAYLIST_TTL_MS = 30 * 1000;
const playlistCache = new Map();

function getCachedPlaylist(code) {
  const e = playlistCache.get(code);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    playlistCache.delete(code);
    return null;
  }
  return e.rows;
}
function setCachedPlaylist(code, rows) {
  if (playlistCache.size > 1000) {
    const firstKey = playlistCache.keys().next().value;
    if (firstKey !== undefined) playlistCache.delete(firstKey);
  }
  playlistCache.set(code, { rows, expiresAt: Date.now() + PLAYLIST_TTL_MS });
}

/* ─────────────── timeline math ─────────────── */

function computeTimelinePosition(epochMs, nowMs, durationsMs) {
  const total = durationsMs.reduce((a, b) => a + b, 0);
  if (total <= 0) return { trackIndex: 0, offsetMs: 0 };
  const elapsedRaw = nowMs - epochMs;
  const elapsed = elapsedRaw < 0 ? 0 : elapsedRaw;
  let inLoop = elapsed % total;
  for (let i = 0; i < durationsMs.length; i++) {
    const d = durationsMs[i];
    if (d <= 0) continue;
    if (inLoop < d) return { trackIndex: i, offsetMs: inLoop };
    inLoop -= d;
  }
  return { trackIndex: 0, offsetMs: 0 };
}

/* ─────────────── pacer ─────────────── */

class BytePacer {
  constructor(bytesPerSec) {
    this.startedAt = Date.now();
    this.bytesSent = 0;
    this.bytesPerSec = Math.max(1, bytesPerSec);
  }
  reset(initialBytes = 0, initialOffsetMs = 0) {
    this.bytesSent = initialBytes;
    this.startedAt = Date.now() - initialOffsetMs;
  }
  setRate(bytesPerSec) {
    this.bytesPerSec = Math.max(1, bytesPerSec);
  }
  async account(n, signal) {
    this.bytesSent += n;
    const targetMs = (this.bytesSent / this.bytesPerSec) * 1000;
    const elapsedMs = Date.now() - this.startedAt;
    const aheadMs = targetMs - elapsedMs;
    if (aheadMs > 5) await sleep(aheadMs, signal);
  }
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal && signal.aborted) return resolve();
    const t = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve();
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

/* ─────────────── helpers ─────────────── */

async function sha256(input) {
  return crypto
    .createHash('sha256')
    .update(input, 'utf8')
    .digest('hex')
    .substring(0, 24);
}

function sanitizeIcyName(name) {
  return (
    (name || 'EgMax Radio')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/[\r\n]/g, ' ')
      .trim()
      .substring(0, 80) || 'EgMax Radio'
  );
}

function parseM3u8SegmentsWithDurations(text, baseUrl) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let pendingDuration = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
      const m = line.match(/^#EXTINF:([\d.]+)/);
      pendingDuration = m ? parseFloat(m[1]) : 0;
      continue;
    }
    if (line.startsWith('#')) continue;
    try {
      out.push({ url: new URL(line, baseUrl).toString(), durationSec: pendingDuration });
    } catch {
      // ignore
    }
    pendingDuration = 0;
  }
  return out;
}

/* ─────────────── streaming ─────────────── */

async function pipeProgressivePaced(url, res, signal, pacer, offsetMs, trackDurationMs) {
  let bytesPerSec = ASSUMED_BYTES_PER_SEC;
  let totalBytes = 0;

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
    /* fall through */
  }

  let byteOffset = 0;
  if (offsetMs > 0) {
    byteOffset = Math.floor((offsetMs / 1000) * bytesPerSec);
    if (totalBytes > 0 && byteOffset >= totalBytes) return;
  }

  const reqHeaders = { ...SC_FETCH_HEADERS };
  if (byteOffset > 0) reqHeaders['Range'] = `bytes=${byteOffset}-`;

  const fetchRes = await fetch(url, { headers: reqHeaders, signal });
  if (!fetchRes.ok || !fetchRes.body) {
    if (byteOffset > 0 && (fetchRes.status === 416 || fetchRes.status === 400)) {
      const fb = await fetch(url, { headers: SC_FETCH_HEADERS, signal });
      if (!fb.ok || !fb.body) throw new Error(`progressive fetch ${fb.status}`);
      await drainBodyPaced(fb.body, res, signal, pacer);
      return;
    }
    throw new Error(`progressive fetch ${fetchRes.status}`);
  }

  await drainBodyPaced(fetchRes.body, res, signal, pacer);
}

async function drainBodyPaced(body, res, signal, pacer) {
  const reader = body.getReader();
  while (true) {
    if (signal.aborted || res.destroyed || res.writableEnded) {
      try { await reader.cancel(); } catch {}
      return;
    }
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.byteLength > 0) {
      await pacer.account(value.byteLength, signal);
      if (signal.aborted || res.destroyed || res.writableEnded) {
        try { await reader.cancel(); } catch {}
        return;
      }
      const ok = res.write(Buffer.from(value));
      if (!ok) {
        // Backpressure — wait for drain before we keep going.
        await new Promise((resolve) => res.once('drain', resolve));
      }
    }
  }
}

async function pipeHlsParallelPaced(manifestUrl, res, signal, pacer, offsetMs) {
  const manifestRes = await fetch(manifestUrl, { headers: SC_FETCH_HEADERS, signal });
  if (!manifestRes.ok) throw new Error(`hls manifest fetch ${manifestRes.status}`);
  const manifestText = await manifestRes.text();
  const segments = parseM3u8SegmentsWithDurations(manifestText, manifestUrl);
  if (segments.length === 0) throw new Error('hls manifest: no segments');

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
    if (!found) return;
  }

  const fetchSegment = async (segUrl) => {
    if (signal.aborted) return null;
    try {
      const r = await fetch(segUrl, { headers: SC_FETCH_HEADERS, signal });
      if (!r.ok) return null;
      const buf = await r.arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      return null;
    }
  };

  const remaining = segments.slice(startSegIdx);
  const queue = [];
  for (let i = 0; i < Math.min(HLS_PREFETCH, remaining.length); i++) {
    queue.push(fetchSegment(remaining[i].url));
  }
  let nextToFetch = queue.length;

  for (let played = 0; played < remaining.length; played++) {
    if (signal.aborted || res.destroyed || res.writableEnded) return;
    const buf = await queue.shift();
    if (nextToFetch < remaining.length) {
      queue.push(fetchSegment(remaining[nextToFetch++].url));
    }
    if (!buf || buf.byteLength === 0) continue;

    if (played === 0 && remaining[0].durationSec > 0) {
      const inferred = buf.byteLength / remaining[0].durationSec;
      if (isFinite(inferred) && inferred > 1000) pacer.setRate(inferred);
    }

    await pacer.account(buf.byteLength, signal);
    if (signal.aborted || res.destroyed || res.writableEnded) {
      await Promise.allSettled(queue);
      return;
    }
    const ok = res.write(Buffer.from(buf));
    if (!ok) {
      await new Promise((resolve) => res.once('drain', resolve));
    }
  }
}

/* ─────────────── main handler ─────────────── */

async function handleRadio(req, res, code) {
  // Load playlist (cache → Supabase)
  let rows = getCachedPlaylist(code);
  if (!rows) {
    const { data: rawRows, error } = await supabase.rpc('get_playlist_by_short_code', {
      p_code: code,
    });
    if (error) {
      console.error('[radio] DB error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Failed to load playlist');
      return;
    }
    rows = rawRows || [];
    if (rows.length > 0) setCachedPlaylist(code, rows);
  }
  if (rows.length === 0) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`Radio not found: ${code}`);
    return;
  }

  const playlistName = rows[0].playlist_name;
  const playlistId = rows[0].playlist_id;

  // Establish/read epoch
  let epochIso = rows[0].broadcast_started_at;
  if (!epochIso) {
    const { data: claimed, error: claimErr } = await supabase.rpc(
      'start_broadcast_if_unset',
      { p_code: code }
    );
    if (claimErr) {
      console.error('[radio] start_broadcast_if_unset error:', claimErr);
      epochIso = new Date().toISOString();
    } else {
      epochIso = claimed;
    }
    playlistCache.delete(code);
    if (rows.length > 0) {
      const updated = rows.map((r) => ({ ...r, broadcast_started_at: epochIso }));
      setCachedPlaylist(code, updated);
    }
  }
  const epochMs = epochIso ? Date.parse(epochIso) : Date.now();

  // Apply mode
  const rawMode = rows[0].default_play_mode || 'sequential';
  const mode = isPlayMode(rawMode) ? rawMode : 'sequential';
  const orderable = rows.map((r) => ({
    id: r.track_id,
    artist: r.track_artist,
    genre: r.track_genre,
    durationMs: r.track_duration_ms,
    addedAt: r.track_position,
  }));
  const ordered = applyPlayMode(orderable, mode, epochMs);
  const trackIds = ordered.map((o) => o.id);
  const durationsMs = ordered.map((o) => o.durationMs || 0);

  // Compute join position
  const start = computeTimelinePosition(epochMs, Date.now(), durationsMs);

  console.log(
    `[radio] ${code} -> "${playlistName}" (${trackIds.length} tracks, mode=${mode}). ` +
      `epoch=${epochIso} join@track=${start.trackIndex} offset=${start.offsetMs}ms ` +
      `UA="${(req.headers['user-agent'] || '').substring(0, 60)}"`
  );

  // Fire-and-forget access logging + play count
  logRadioAccess(code, req).catch((e) => console.error('[radio] log failed:', e));
  incrementPlayCount(playlistId).catch((e) => console.error('[radio] play_count failed:', e));

  const safeName = sanitizeIcyName(playlistName);
  res.writeHead(200, {
    ...RADIO_HEADERS,
    'icy-name': safeName,
    'icy-genre': 'Various',
    'icy-description': `EgMax radio · ${safeName}`,
    'icy-br': String(ASSUMED_BITRATE_KBPS),
  });

  const ac = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) {
      console.log(`[radio] ${code} client disconnected`);
    }
    ac.abort();
  });

  const sc = getSoundCloudClient();
  let trackIndex = start.trackIndex;
  let initialOffsetMs = start.offsetMs;
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = trackIds.length * 2;
  const pacer = new BytePacer(ASSUMED_BYTES_PER_SEC);
  let nextTrackPromise = sc.resolveMp3Stream(trackIds[start.trackIndex]);

  while (!ac.signal.aborted && !res.destroyed && !res.writableEnded) {
    const trackId = trackIds[trackIndex % trackIds.length];

    let mp3 = null;
    try {
      mp3 = await (nextTrackPromise || sc.resolveMp3Stream(trackId));
    } catch (e) {
      console.error(`[radio] ${code} resolve failed track ${trackId}:`, e);
    }

    const nextIdx = (trackIndex + 1) % trackIds.length;
    nextTrackPromise = sc.resolveMp3Stream(trackIds[nextIdx]).catch((e) => {
      console.error(`[radio] prefetch track ${trackIds[nextIdx]}:`, e);
      return null;
    });

    if (!mp3) {
      consecutiveFailures++;
      console.warn(
        `[radio] ${code} skip track ${trackId} (no MP3). failures=${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}`
      );
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`[radio] ${code} too many failures, ending stream`);
        res.end();
        return;
      }
      const fix = computeTimelinePosition(epochMs, Date.now(), durationsMs);
      trackIndex = fix.trackIndex;
      initialOffsetMs = fix.offsetMs;
      continue;
    }
    consecutiveFailures = 0;

    pacer.reset(0, initialOffsetMs);

    try {
      if (mp3.type === 'progressive') {
        await pipeProgressivePaced(
          mp3.url,
          res,
          ac.signal,
          pacer,
          initialOffsetMs,
          durationsMs[trackIndex % durationsMs.length] || 0
        );
      } else {
        await pipeHlsParallelPaced(mp3.url, res, ac.signal, pacer, initialOffsetMs);
      }
    } catch (e) {
      if (
        ac.signal.aborted ||
        (e && e.name === 'AbortError') ||
        res.destroyed ||
        res.writableEnded
      ) {
        return;
      }
      console.error(`[radio] ${code} stream error track ${trackId}:`, e && e.message ? e.message : e);
    }

    initialOffsetMs = 0;
    trackIndex++;
  }

  if (!res.writableEnded) res.end();
}

async function logRadioAccess(code, req) {
  try {
    const ua = req.headers['user-agent'] || 'unknown';
    const ip =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const ipHash = await sha256(ip);
    await supabase.from('stream_access_logs').insert({
      stream_token: code,
      user_agent: ('[radio:fly] ' + ua).substring(0, 500),
      ip_hash: ipHash,
    });
  } catch (e) {
    console.error('[radio] logRadioAccess error:', e);
  }
}

async function incrementPlayCount(playlistId) {
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

/* ─────────────── server ─────────────── */

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET';
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  // CORS preflight (some IMVU-related embeds need it)
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Icy-MetaData, Range',
    });
    res.end();
    return;
  }

  // Liveness probe for Fly.io
  if (path === '/healthz' || path === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  // /radio/{code}.mp3 — the only real endpoint
  const radioMatch = path.match(/^\/radio\/([^/]+?)(?:\.(mp3|m3u|pls))?\/?$/i);
  if (radioMatch) {
    const code = radioMatch[1].toLowerCase();
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid radio URL');
      return;
    }
    if (method === 'HEAD') {
      res.writeHead(200, {
        ...RADIO_HEADERS,
        'icy-name': 'EgMax Radio',
        'icy-br': String(ASSUMED_BITRATE_KBPS),
      });
      res.end();
      return;
    }
    if (method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'GET, HEAD, OPTIONS' });
      res.end('Method Not Allowed');
      return;
    }
    try {
      await handleRadio(req, res, code);
    } catch (e) {
      console.error('[radio] unhandled error:', e);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      if (!res.writableEnded) res.end();
    }
    return;
  }

  // Anything else → 404 (this server is radio-only).
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('This server hosts only /radio/{code}.mp3. The main app lives elsewhere.');
});

// Generous timeouts — we WANT long-lived connections.
server.timeout = 0; // no idle timeout; the radio loop manages itself
server.keepAliveTimeout = 60 * 1000;
server.headersTimeout = 65 * 1000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[boot] EgMax radio server listening on :${PORT}`);
});

// Graceful shutdown for Fly.io rolling deploys
function shutdown(signal) {
  console.log(`[boot] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
  // Force-exit after 10s if connections won't close.
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
