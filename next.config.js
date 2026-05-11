/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow production builds to succeed even with TS or lint warnings.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.sndcdn.com',
      },
    ],
  },

  /**
   * URL Rewrites
   *
   * /stream/:code         -> /api/stream/:code         (M3U playlist - VLC, browsers)
   * /stream/:code.m3u     -> /api/stream/:code         (M3U playlist with extension)
   * /radio/:code          -> /api/radio/:code          (Icecast MP3 stream - IMVU)
   * /radio/:code.mp3      -> /api/radio/:code          (Icecast MP3 stream with extension)
   */
  async rewrites() {
    return [
      // M3U (works in VLC, browsers, mobile media players)
      {
        source: '/stream/:slug.m3u',
        destination: '/api/stream/:slug',
      },
      {
        source: '/stream/:slug',
        destination: '/api/stream/:slug',
      },
      // Icecast MP3 radio (works in IMVU, Shoutcast/Icecast players)
      {
        source: '/radio/:slug.mp3',
        destination: '/api/radio/:slug',
      },
      {
        source: '/radio/:slug',
        destination: '/api/radio/:slug',
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/api/stream/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        source: '/api/stream-resolve/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        // IMVU radio endpoint — no caching, no buffering
        source: '/api/radio/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'X-Accel-Buffering', value: 'no' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
