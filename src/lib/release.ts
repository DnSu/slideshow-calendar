/** The deployment this page's code was built for (baked in at build time); "dev" outside Vercel. */
export const BUILT_RELEASE = process.env.NEXT_PUBLIC_RELEASE || "dev";

/** The deployment this server is running; "dev" outside Vercel. Read per request, never cached. */
export function currentRelease(): string {
  return process.env.VERCEL_DEPLOYMENT_ID || "dev";
}

/**
 * Should the screen reload because the server runs a different deployment than the page?
 * Only for live, successful responses while online; never for "dev", never twice for the same
 * target release (a loop guard: `alreadyTried` is true if we already reloaded for `incoming`).
 */
export function shouldReloadForRelease(
  known: string | null,
  incoming: string | undefined,
  opts: { online: boolean; fromCache: boolean; alreadyTried: boolean },
): boolean {
  if (!known || !incoming) return false;
  if (known === "dev" || incoming === "dev") return false;
  if (known === incoming) return false;
  if (!opts.online || opts.fromCache || opts.alreadyTried) return false;
  return true;
}
