import { revalidateTag } from "next/cache";
import { connection } from "next/server";
import { SOURCE_TAGS } from "@/lib/playlist";

/**
 * POST: drop the server's cached copies of Drive, the calendar and the weather, so the next
 * playlist request reads Google again. Used by the /slideshow preview's Refresh button; screens
 * pick up the fresh copy at their next playlist check. Rate-limited per server instance so it
 * can't be used to hammer Google.
 */
const COOLDOWN_MS = 30_000;
let lastRefresh = 0;

export async function POST() {
  await connection();
  const now = Date.now();
  const wait = lastRefresh + COOLDOWN_MS - now;
  if (wait > 0) {
    return Response.json(
      { refreshed: false, retryAfterSeconds: Math.ceil(wait / 1000) },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.ceil(wait / 1000)),
        },
      },
    );
  }
  lastRefresh = now;
  // expire: 0 → the next read blocks on a fresh Drive listing instead of serving the old one.
  for (const tag of Object.values(SOURCE_TAGS))
    revalidateTag(tag, { expire: 0 });
  return Response.json(
    { refreshed: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
