import { cacheLife } from "next/cache";
import { fetchEvents } from "./calendar";
import { buildSettings, getEnv, parseOverrideText } from "./config";
import { addDays, dayInTz } from "./dates";
import { downloadText, isImageEntry, listFolder, type DriveEntry } from "./drive";
import { parseFolderName, type DateWindow } from "./folderDates";
import type { Playlist, PlaylistEvent, PlaylistImage } from "./types";

type DriveSnapshot = {
  root: DriveEntry[];
  folders: { name: string; window: DateWindow; entries: DriveEntry[] }[];
  override: unknown;
  fetchedAt: number;
};

/**
 * Cached reads of Google. Each is cached for `refresh.sourceMinutes` (profile "source" in
 * next.config.ts) with a long expiry, so a stale copy keeps being served while a refresh
 * runs, and a failed refresh leaves the old copy in place. `remote` shares the cache across
 * server instances. Arguments are part of the cache key; they never reach the browser.
 */
async function loadDrive(folderId: string, timezone: string): Promise<DriveSnapshot> {
  "use cache: remote";
  cacheLife("source");

  const rootListing = await listFolder(folderId);
  if (!rootListing.recognized) {
    throw new Error("Drive folder page not recognised; keeping the previous listing");
  }
  const today = dayInTz(Date.now(), timezone);
  const folders: DriveSnapshot["folders"] = [];
  for (const f of rootListing.entries.filter((e) => e.isFolder)) {
    const parsed = parseFolderName(f.name);
    if (!parsed.ok) {
      console.warn(`[drive] ignoring folder "${f.name}": ${parsed.reason}`);
      continue;
    }
    // A day of margin so a Drive-side timezone override can't drop a folder early.
    if (parsed.window.end && parsed.window.end < addDays(today, -1)) continue;
    const listing = await listFolder(f.id);
    if (!listing.recognized) throw new Error(`Drive subfolder page not recognised ("${f.name}")`);
    folders.push({ name: f.name, window: parsed.window, entries: listing.entries });
  }
  const override = await readOverride(rootListing.entries, downloadText);
  return { root: rootListing.entries, folders, override, fetchedAt: Date.now() };
}

/**
 * The parsed Drive config.json from the root folder's entries, or null. Never throws: a
 * missing, unreadable, oversized or malformed file is ignored (logged) so it can't stop
 * the images from updating. Only a file named exactly "config.json" counts.
 */
export async function readOverride(
  entries: DriveEntry[],
  download: (fileId: string) => Promise<string>,
): Promise<unknown> {
  const file = entries.find((e) => !e.isFolder && e.name.toLowerCase() === "config.json");
  if (!file) return null;
  try {
    return parseOverrideText(await download(file.id));
  } catch (err) {
    console.warn(`[config] could not read Drive config.json; ignored: ${(err as Error).message}`);
    return null;
  }
}

async function loadCalendar(calendarId: string, fetchDays: number, timezone: string) {
  "use cache: remote";
  cacheLife("source");
  return { events: await fetchEvents(calendarId, fetchDays, timezone), fetchedAt: Date.now() };
}

// Per-instance safety net if the shared cache has nothing (e.g. right after a deploy).
const lastGood = new Map<string, unknown>();
async function resilient<T>(key: string, load: () => Promise<T>): Promise<T | null> {
  try {
    const v = await load();
    lastGood.set(key, v);
    return v;
  } catch (err) {
    console.error(`[playlist] ${key} refresh failed: ${(err as Error).message}`);
    return (lastGood.get(key) as T | undefined) ?? null;
  }
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

/** Pure assembly of the image list: root first, then folders by name; ended windows dropped. */
export function assembleImages(snapshot: Pick<DriveSnapshot, "root" | "folders">, today: string): PlaylistImage[] {
  const images: PlaylistImage[] = [];
  const add = (entries: DriveEntry[], w: DateWindow) => {
    for (const e of entries.filter(isImageEntry).sort(byName)) {
      images.push({
        id: e.id,
        name: e.name,
        start: w.start,
        end: w.end,
        ...(w.yearly ? { yearly: w.yearly } : {}),
      });
    }
  };
  add(snapshot.root, { start: null, end: null });
  for (const f of [...snapshot.folders].sort(byName)) {
    if (f.window.end !== null && f.window.end < today) continue;
    add(f.entries, f.window);
  }
  return images;
}

export async function getImageIds(): Promise<Set<string>> {
  const env = getEnv();
  const drive = await resilient("drive", () => loadDrive(env.driveFolderId, env.timezone));
  if (!drive) return new Set();
  return new Set(assembleImages(drive, dayInTz(Date.now(), env.timezone)).map((i) => i.id));
}

export async function getPlaylist(): Promise<Playlist> {
  const env = getEnv();
  const now = Date.now();
  const degraded: Playlist["degraded"] = [];

  const drive = await resilient("drive", () => loadDrive(env.driveFolderId, env.timezone));
  if (!drive) degraded.push("drive");
  const config = buildSettings(env.timezone, drive?.override ?? null);

  const cal = await resilient("calendar", () =>
    loadCalendar(env.calendarId, config.calendar.fetchDays, config.timezone),
  );
  if (!cal) degraded.push("calendar");

  const events: PlaylistEvent[] = (cal?.events ?? []).filter((e) => e.end >= now);
  const images = drive ? assembleImages(drive, dayInTz(now, config.timezone)) : [];
  return { images, events, config, serverTime: now, degraded };
}

