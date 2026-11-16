import type { Playlist } from "./types";

/**
 * Combine a freshly received playlist with the one the screen already holds.
 * Returns the previous playlist if the new one is older (e.g. a saved copy served offline),
 * and keeps the previous images/events/config for any source the server reports as degraded.
 */
export function mergePlaylist(prev: Playlist | null, next: Playlist): Playlist {
  if (!prev) return next;
  if (next.serverTime < prev.serverTime) return prev;
  const driveDown = next.degraded.includes("drive");
  const calendarDown = next.degraded.includes("calendar");
  return {
    ...next,
    images: driveDown ? prev.images : next.images,
    config: driveDown ? { ...prev.config } : next.config,
    events: calendarDown ? prev.events : next.events,
  };
}
