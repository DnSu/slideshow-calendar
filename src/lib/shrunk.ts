import type { DriveIssue } from "./types";

/**
 * Response headers on /api/image when a picture was too big and the server made it smaller:
 * its size from Drive and the size sent, in bytes. The /slideshow preview reads them with a
 * HEAD request, so it doesn't download every picture again. (Kept out of imageResponse.ts so
 * the browser bundle doesn't pull in sharp.)
 */
export const SHRUNK_HEADER = "X-Shrunk-From-Bytes";
export const SENT_HEADER = "X-Shrunk-To-Bytes";

export function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** The note shown in /slideshow for a picture that was made smaller. */
export function shrunkIssue(name: string, fromBytes: number, toBytes: number): DriveIssue {
  return {
    name,
    reason: `is ${formatBytes(fromBytes)}, more than the screens need, so it's sent as ${formatBytes(toBytes)}. It still shows; for the sharpest result, upload it at 1080 × 1920 (JPG, or PNG under 3.5 MB)`,
  };
}
