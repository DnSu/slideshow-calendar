import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

const defaults = JSON.parse(readFileSync(new URL("./slideshow.config.json", import.meta.url), "utf8"));

const nextConfig: NextConfig = {
  // The deployment this bundle was built for, so a screen knows which version its code is.
  // Vercel sets VERCEL_DEPLOYMENT_ID for builds too; "dev" elsewhere (no auto-reload).
  env: { NEXT_PUBLIC_RELEASE: process.env.VERCEL_DEPLOYMENT_ID || "dev" },
  cacheComponents: true,
  partialPrefetching: true,
  cacheLife: {
    // Google data: refreshed every refresh.sourceMinutes; a stale copy is served for up to
    // 30 days if refreshing keeps failing.
    source: {
      stale: 60,
      revalidate: defaults.refresh.sourceMinutes * 60,
      expire: 30 * 24 * 3600,
    },
    // Place lookups (ZIP to coordinates) never change; refreshed monthly.
    location: {
      stale: 3600,
      revalidate: 30 * 24 * 3600,
      expire: 365 * 24 * 3600,
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "text/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
