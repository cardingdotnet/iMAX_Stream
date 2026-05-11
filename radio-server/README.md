# Radio Server — Standalone deployment for Fly.io

This is the **radio streaming endpoint only**, packaged as a standalone Node.js
server suitable for long-lived HTTP responses (which serverless platforms
like Vercel and Cloudflare Workers can't provide without timing out).

## Why this exists

The main app deploys to Cloudflare Pages (unlimited bandwidth, free) but
Cloudflare Workers caps each request at 30s (free) or 5 minutes (paid). For
an IMVU radio that needs to stream for hours uninterrupted, we run **just
the radio route** on Fly.io's free tier — which has no per-request time
limit.

The web app proxies/redirects `/radio/{code}.mp3` requests to this server.

## Setup

### 1. Install Fly.io CLI

```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex
```

### 2. Sign up + login

```bash
fly auth signup    # or `fly auth login` if you already have an account
```

### 3. Set secrets

The radio server needs the same Supabase + SoundCloud credentials as the
main app. Copy them from your `.env.local`:

```bash
fly secrets set \
  SUPABASE_URL=https://xxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... \
  SOUNDCLOUD_CLIENT_ID=your_sc_client_id \
  --app egmax-radio
```

### 4. Deploy

```bash
cd radio-server
fly launch --no-deploy   # First time only — answers most questions automatically
fly deploy
```

Fly will give you a URL like `https://egmax-radio.fly.dev`. The radio
endpoint is at:

```
https://egmax-radio.fly.dev/radio/{code}.mp3
```

### 5. Point the main app at it

In your Cloudflare Pages dashboard, set the environment variable:

```
RADIO_BASE_URL=https://egmax-radio.fly.dev
```

The main app's `/radio/{code}.mp3` route will redirect to the Fly.io
server when this is set.

## Resource usage

Fly.io free tier includes:
- 3 shared-cpu-1x VMs (256MB each) — we use 1
- 160 GB outbound transfer / month — plenty for a few simultaneous radios
- No per-request timeout

A 24/7 radio streaming 128kbps to 1 listener uses ~40 GB/month. So you can
run ~4 concurrent listeners forever on the free tier without paying.
