/**
 * SoundCloud V2 client — minimal Node port of lib/soundcloud/client.ts.
 *
 * Same caching strategy:
 *   - track metadata: 5 min
 *   - chosen MP3 transcoding endpoint: 5 min
 *   - signed CDN URL: 50s (SC signs ~60s)
 *   - in-flight dedup so concurrent requests for the same track only hit
 *     SC once.
 */

const SOUNDCLOUD_API_V2 = 'https://api-v2.soundcloud.com';

const DEFAULT_HEADERS = {
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://soundcloud.com/',
  Origin: 'https://soundcloud.com',
};

function isMp3Transcoding(t) {
  const mime = String((t && t.format && t.format.mime_type) || '').toLowerCase();
  const preset = String((t && t.preset) || '').toLowerCase();
  return mime.includes('mpeg') || preset.startsWith('mp3');
}

class TTLCache {
  constructor(ttlMs, maxSize = 500) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
    this.store = new Map();
  }
  get(key) {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (Date.now() > e.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }
  set(key, value) {
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
  delete(key) {
    this.store.delete(key);
  }
}

const trackMetaCache = new TTLCache(5 * 60 * 1000);
const mp3TranscodingCache = new TTLCache(5 * 60 * 1000);
const resolvedUrlCache = new TTLCache(50 * 1000);
const inFlight = new Map();

class SoundCloudClient {
  constructor(clientId) {
    if (!clientId) throw new Error('SoundCloud client ID is required');
    this.clientId = clientId;
  }

  async getTrackRaw(trackId) {
    const key = `meta:${trackId}`;
    const cached = trackMetaCache.get(key);
    if (cached) return cached;
    const url = `${SOUNDCLOUD_API_V2}/tracks/${trackId}?client_id=${encodeURIComponent(this.clientId)}`;
    const res = await fetch(url, { headers: DEFAULT_HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    trackMetaCache.set(key, data);
    return data;
  }

  async resolveMp3Stream(trackId) {
    const hot = resolvedUrlCache.get(`url:${trackId}`);
    if (hot) {
      return {
        trackId,
        url: hot.url,
        type: hot.protocol,
        mimeType: 'audio/mpeg',
      };
    }
    const flightKey = `flight:${trackId}`;
    const inflight = inFlight.get(flightKey);
    if (inflight) return inflight;
    const promise = this._resolveMp3StreamInner(trackId);
    inFlight.set(flightKey, promise);
    try {
      return await promise;
    } finally {
      inFlight.delete(flightKey);
    }
  }

  async _resolveMp3StreamInner(trackId) {
    try {
      let pick = mp3TranscodingCache.get(`pick:${trackId}`);
      if (!pick) {
        const track = await this.getTrackRaw(trackId);
        if (!track) return null;
        const transcodings = (track.media && track.media.transcodings) || [];
        if (transcodings.length === 0) {
          console.error(`[mp3] No transcodings for track ${trackId}`);
          return null;
        }
        const full = transcodings.filter((t) => !t.snipped);
        const pool = full.length > 0 ? full : transcodings;
        const mp3 = pool.filter(isMp3Transcoding);
        if (mp3.length === 0) {
          console.error(
            `[mp3] Track ${trackId} has no MP3 transcoding ` +
              `(available: ${pool.map((t) => t.preset).join(', ')})`
          );
          return null;
        }
        const chosen =
          mp3.find((t) => t.format && t.format.protocol === 'progressive') ||
          mp3.find((t) => t.format && t.format.protocol === 'hls') ||
          mp3[0];
        const protocol =
          chosen.format && chosen.format.protocol === 'hls' ? 'hls' : 'progressive';
        pick = { url: chosen.url, protocol };
        mp3TranscodingCache.set(`pick:${trackId}`, pick);
      }
      const transcodingUrl = `${pick.url}?client_id=${encodeURIComponent(this.clientId)}`;
      const resolveResponse = await fetch(transcodingUrl, { headers: DEFAULT_HEADERS });
      if (!resolveResponse.ok) {
        console.error(
          `[mp3] Transcoding resolve failed for track ${trackId}: ${resolveResponse.status}`
        );
        mp3TranscodingCache.delete(`pick:${trackId}`);
        return null;
      }
      const data = await resolveResponse.json();
      if (!data.url) return null;
      resolvedUrlCache.set(`url:${trackId}`, { url: data.url, protocol: pick.protocol });
      return {
        trackId,
        url: data.url,
        type: pick.protocol,
        mimeType: 'audio/mpeg',
      };
    } catch (error) {
      console.error(`[mp3] Failed to resolve track ${trackId}:`, error);
      return null;
    }
  }
}

let _client = null;
function getSoundCloudClient() {
  if (!_client) {
    const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
    if (!clientId) throw new Error('SOUNDCLOUD_CLIENT_ID environment variable is not set');
    _client = new SoundCloudClient(clientId);
  }
  return _client;
}

module.exports = { getSoundCloudClient, DEFAULT_HEADERS };
