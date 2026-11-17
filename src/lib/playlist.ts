import { cacheLife } from "next/cache";
import { fetchEvents } from "./calendar";
import type { Settings } from "./config";
import { buildSettings, getEnv, getWeatherLocation, parseOverrideText } from "./config";
import { addDays, dayInTz } from "./dates";
import { downloadText, isImageEntry, listFolder, type DriveEntry, fileVersion } from "./drive";
import { parseFolderName, type DateWindow } from "./folderDates";
import type { Playlist, PlaylistEvent, PlaylistImage, PlaylistWeather, WeatherUnits } from "./types";
import { currentRelease } from "./release";
import { fetchForecast, fetchGeocode } from "./weather";

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

async function loadWeather(latitude: number, longitude: number, timezone: string, units: WeatherUnits) {
  "use cache: remote";
  cacheLife("source");
  return fetchForecast(latitude, longitude, timezone, units);
}

/** ZIP to coordinates. They never change, so this is cached for weeks (profile "location"). */
async function loadLocation(zip: string, country: string) {
  "use cache: remote";
  cacheLife("location");
  return fetchGeocode(zip, country);
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
        ...(e.modified ? { version: fileVersion(e.modified) } : {}),
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

/**
 * The forecast, or null when weather is off, has no location, or has never loaded. Never throws.
 * A configured location whose lookup or forecast failed with no earlier copy marks "weather" degraded.
 */
async function loadWeatherSource(
  config: Settings,
  degraded: Playlist["degraded"],
): Promise<PlaylistWeather | null> {
  if (!config.weather.enabled) return null;
  const location = getWeatherLocation();
  if (!location) return null;
  const { timezone } = config;
  const units = config.weather.units;
  let coords: { latitude: number; longitude: number } | null;
  if (location.kind === "coords") coords = location;
  else {
    coords = await resilient("location", () => loadLocation(location.zip, location.country));
    if (!coords) console.warn("[weather] could not resolve WEATHER_ZIP; weather disabled until it can");
  }
  const weather = coords
    ? await resilient("weather", () => loadWeather(coords.latitude, coords.longitude, timezone, units))
    : null;
  if (!weather) degraded.push("weather");
  return weather;
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

  const weather = await loadWeatherSource(config, degraded);

  const events: PlaylistEvent[] = (cal?.events ?? []).filter((e) => e.end >= now);
  const images = drive ? assembleImages(drive, dayInTz(now, config.timezone)) : [];
  return { images, events, config, weather, serverTime: now, degraded, release: currentRelease() };
}

