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
export function imageHeaders(type: string): Record<string, string> {
  return {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    // Safe to cache long: a replaced file gets a new ?v= in its URL (see fileVersion).
    "Cache-Control": "public, max-age=604800, s-maxage=604800",
  };
}
