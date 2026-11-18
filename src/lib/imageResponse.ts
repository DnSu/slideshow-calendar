import sharp from "sharp";
import { SENT_HEADER, SHRUNK_HEADER } from "./shrunk";

export { SENT_HEADER, SHRUNK_HEADER };

/**
 * The /api/image proxy serves Drive thumbnails from this site's own domain, so it only passes
 * on plain raster pictures: an SVG (or anything else) could carry script that would run here.
 */
const RASTER = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/bmp"]);

/** The content type to serve, or null if the upstream response isn't a raster picture. */
export function rasterType(contentType: string | null): string | null {
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  return RASTER.has(type) ? type : null;
}


/** Headers for a proxied picture: no type sniffing, and nothing in it may run or load. */
export function imageHeaders(type: string, shrunk?: { from: number; to: number }): Record<string, string> {
  return {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    // Safe to cache long: a replaced file gets a new ?v= in its URL (see fileVersion).
    "Cache-Control": "public, max-age=604800, s-maxage=604800",
    ...(shrunk ? { [SHRUNK_HEADER]: String(shrunk.from), [SENT_HEADER]: String(shrunk.to) } : {}),
  };
}

/** Longest side a picture needs: a full-HD screen, either way up. */
export const MAX_SIDE = 1920;
/** Pictures at or under this size (and MAX_SIDE) are passed on untouched, pixel for pixel. */
export const PASS_THROUGH_BYTES = 3.5 * 1024 * 1024;
/** Vercel functions can't send more than 4.5 MB; stay clear of it. */
const MAX_SEND_BYTES = 4 * 1024 * 1024;

export type Fitted = { body: Uint8Array<ArrayBuffer>; type: string; shrunkFrom?: number };

/**
 * Make a picture safe to send to the screens. Pictures that already fit (long side ≤ MAX_SIDE
 * and ≤ PASS_THROUGH_BYTES) are returned untouched. Bigger ones (someone uploads a huge photo or
 * poster) are fitted inside MAX_SIDE × MAX_SIDE, never enlarged, as high-quality WebP (keeps
 * transparency), so they load quickly and stay under Vercel's response limit.
 */
export async function fitForScreen(body: Uint8Array<ArrayBuffer>, type: string): Promise<Fitted> {
  let width = 0;
  let height = 0;
  try {
    ({ width = 0, height = 0 } = await sharp(body).metadata());
  } catch {
    // Can't read it: pass it on if it's small enough, and let the browser decide.
    if (body.length <= MAX_SEND_BYTES) return { body, type };
    throw new Error("picture is too large and couldn't be read");
  }
  if (Math.max(width, height) <= MAX_SIDE && body.length <= PASS_THROUGH_BYTES) return { body, type };

  const encode = (quality: number) =>
    sharp(body, { animated: false })
      .rotate() // apply the camera's orientation before resizing
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  let out = await encode(90);
  if (out.length > MAX_SEND_BYTES) out = await encode(75);
  if (out.length > MAX_SEND_BYTES) throw new Error("picture is still too large after shrinking");
  return { body: new Uint8Array(out), type: "image/webp", shrunkFrom: body.length };
}
