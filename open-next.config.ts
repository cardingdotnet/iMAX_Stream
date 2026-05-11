// open-next.config.ts
//
// Configures @opennextjs/cloudflare to package this Next.js app for
// Cloudflare Workers (which is what Cloudflare Pages uses under the hood
// for SSR Next.js apps as of late 2025).
//
// We use the default Cloudflare preset, which:
//   - Builds the app with Next.js standard `next build` (Node.js runtime
//     supported via nodejs_compat — no need to convert routes to Edge).
//   - Wraps it with the OpenNext server entry, deployable to Workers.
//   - Caches via Workers KV (no extra setup on free tier).

import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig({
  // Defaults are appropriate for our app:
  //  - In-memory cache (no R2/KV setup required for free tier).
  //  - No incremental cache invalidation (the app doesn't use ISR).
  //
  // If you later want global caching, add `incrementalCache: r2IncrementalCache`
  // here; for now we keep it minimal.
});
