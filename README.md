# 🎵 Spotify Clone — Stream Anywhere (IMVU-Compatible)

A Spotify-like music streaming app where each user gets:

- A **playlist URL** (`.m3u`) that plays in VLC, browsers, mobile media players, car stereos.
- An **IMVU radio URL** (`.mp3`) that plays directly in IMVU's room radio streaming feature.

## ✨ Features

- 🔐 User authentication (signup/login)
- 🎵 Search SoundCloud's library
- 📝 Create and manage playlists
- 🔗 **Per-playlist M3U URL** — `https://yoursite.com/stream/{code}.m3u`
- 📻 **Per-playlist IMVU radio URL** — `https://yoursite.com/radio/{code}.mp3`
- 🎨 Spotify-inspired UI
- 🌐 Bilingual support (English / Arabic)

## 🏗️ Architecture

```
Frontend (Next.js 14)         → Vercel
Backend (API Routes)          → Vercel Serverless Functions (Node runtime)
Database + Auth               → Supabase
Music Source                  → SoundCloud V2 API
Radio Stream Endpoint         → Long-lived Node response (audio/mpeg)
```

> ⚠️ **Hosting note for the radio endpoint — important for IMVU listeners**
>
> The radio endpoint streams continuously, but Vercel Serverless functions
> have a hard execution-time cap: **10 seconds on Hobby**, 60s on Pro,
> 300s on Pro with extended duration. When the cap is hit Vercel kills the
> response and IMVU's player auto-reconnects to the same URL.
>
> The endpoint runs as a **shared synchronized broadcast**: every listener
> on the same `{code}` hears the same audio at the same wall-clock instant,
> Icecast-style. A late joiner drops into whatever is playing right now
> (mid-track if needed), not at track 1. This means reconnects after a
> Vercel timeout are also "free" — the listener simply rejoins the live
> timeline, no per-listener cursor needed. They will still hear a brief
> audio gap each time the connection drops, but they stay in sync with
> everyone else in the room.
>
> For a truly seamless infinite stream — what you want for an IMVU room —
> deploy to a host that supports long-lived HTTP responses:
>
> | Host        | Tier            | Streaming behavior                |
> | ----------- | --------------- | --------------------------------- |
> | Fly.io      | Free / Hobby    | ✅ Unlimited duration             |
> | Railway     | Hobby ($5/mo)   | ✅ Unlimited duration             |
> | Render      | Free / Starter  | ✅ Unlimited duration             |
> | VPS (any)   | DigitalOcean +  | ✅ Unlimited duration             |
> | Vercel      | Hobby           | ⚠️ 10s cap → reconnect every 10s  |
> | Vercel Pro  | Pro             | ⚠️ 60–300s cap → periodic gap     |
>
> The non-radio routes (`/stream/{code}.m3u`, search, library, etc.) work
> fine on any tier because they return instantly.

## 🚀 Setup

1. **Create accounts (all free tiers):**
   - [Vercel](https://vercel.com) (or Fly / Railway / Render for long radio streams)
   - [Supabase](https://supabase.com)
   - SoundCloud client ID (extract from soundcloud.com web inspector)

2. **Clone and install:**
   ```bash
   git clone <your-repo>
   cd spotify-clone
   npm install
   ```

3. **Setup `.env.local`:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   SOUNDCLOUD_CLIENT_ID=your_soundcloud_client_id
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

4. **Run the SQL files in `database/`** in your Supabase SQL editor (in order):
   - `schema.sql`
   - `migration_add_slug.sql`
   - `migration_short_codes.sql`
   - `migration_perf.sql` ← **important for fast page loads**

5. **Run dev server:**
   ```bash
   npm run dev
   ```

## 🔗 The Two Stream URLs

When a user creates a playlist, the share card shows two URLs:

### 📻 IMVU Radio URL — for IMVU rooms

```
https://yoursite.com/radio/ax8k2m.mp3
```

- **Always use this URL inside IMVU.**
- The endpoint emits a continuous Icecast-style MP3 byte stream.
- Tracks loop forever; the stream never ends.
- Each track gets a fresh SoundCloud signed URL when its turn comes up,
  so the stream never breaks from expired CDN tokens.
- Headers include `Content-Type: audio/mpeg`, `icy-name`, `icy-br`, etc. —
  exactly what IMVU's radio player expects.

### 🎵 Playlist (M3U) URL — for VLC / browsers / mobile

```
https://yoursite.com/stream/ax8k2m
https://yoursite.com/stream/ax8k2m.m3u
```

- Returns a standard `#EXTM3U` playlist.
- Each entry redirects to a fresh SoundCloud stream URL on play.
- The first entry of the .m3u also points back at the IMVU radio stream
  as a courtesy fallback for primitive clients.

## ❓ Why two URLs?

Because IMVU's room radio player is **not** a generic media player.

According to IMVU's official documentation:

> *"only MPEG audio formats (MP3) are currently supported. Other formats, such as AAC, are not supported and will not play as expected."*
>
> — [IMVU Support — Radio Streaming](https://support.imvu.com/support/solutions/articles/154000216641-radio-streaming)

> *"The only URLs that work in the IMVU 'Live' room streaming radio player are what is known as 'Direct Stream' URLs."*
>
> — IMVU Community Center

That means:

| Player          | Wants                        | Endpoint to use                  |
|-----------------|------------------------------|----------------------------------|
| **IMVU**        | Continuous MP3 (Icecast)     | `/radio/{code}.mp3`              |
| VLC             | M3U playlist                 | `/stream/{code}.m3u`             |
| Browsers        | Either                       | Either (radio is simpler)        |
| Car stereos     | M3U / direct MP3             | Either                           |
| Web app player  | Per-track JSON               | `/api/stream-resolve/{id}?format=json` |

The `/radio` endpoint:
1. Loads the playlist's tracks from the DB.
2. For each track in order: resolves a fresh SoundCloud **MP3-only** transcoding (rejecting Opus/AAC, which IMVU can't decode).
3. Pipes the MP3 bytes (progressive file or HLS-MP3 segments concatenated) straight to the client.
4. When the playlist ends, loops back to the start.
5. Stops only when the IMVU client disconnects.

## 🧰 Debugging IMVU playback

If the radio URL doesn't play in an IMVU room:

1. **Open the URL in Chrome / Edge** — music should start playing instantly.
   If the browser shows a download prompt or text, the stream isn't healthy.
2. **Check server logs** for `[radio]` lines — they show track resolution and any failures (e.g., a track has no MP3 transcoding available).
3. **Make sure the playlist has tracks** that have MP3 transcodings on SoundCloud. Almost all do, but a small number are HLS-Opus only — the radio endpoint will skip those automatically.
4. **Use HTTPS** — IMVU requires HTTPS. Plain HTTP URLs won't load.
5. **Verify hosting supports long responses** — see the hosting note above.
6. **In IMVU**, paste the URL into the room radio dialog. If it shows "Off Air", click Play.

## 💰 Cost

Same as before. Note: a long-running radio host (e.g. Fly.io free tier, Railway hobby plan) is roughly free at low traffic; on a VPS, expect a few dollars/month per concurrent listener due to bandwidth.
