import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { fetchEvents } from "./calendar";
import type { CoreSettings, Settings } from "./config";
import {
  buildSettings,
  defaultSettings,
  getEnv,
  getWeatherLocation,
  parseOverrideText,
} from "./config";
import { addDays, dayInTz } from "./dates";
import {
  downloadText,
  isImageEntry,
  listFolder,
  type DriveEntry,
  fileVersion,
} from "./drive";
import { parseFolderName, stripLabel, type DateWindow } from "./folderDates";
import { holidayOccurrence, parseHolidayRule, type HolidayRule } from "./holidays";
import type {
  Playlist,
  PlaylistEvent,
  PlaylistImage,
  PlaylistWeather,
  SourceStatus,
  WeatherUnits,
} from "./types";
import { currentRelease } from "./release";
import { fetchForecast, fetchGeocode } from "./weather";

type DriveSnapshot = {
  root: DriveEntry[];
  /** Contents of the root's "Emergency Override" folder (empty if there is none). */
  emergency: DriveEntry[];
  folders: { name: string; window: DateWindow; entries: DriveEntry[] }[];
  /**
   * Folders inside the root's "Holidays" folder. `rule` for holiday names ("July 4",
   * "Last Monday in May"); `window` for ordinary date-folder names. Absent in snapshots
   * cached before this existed.
   */
  holidays?: HolidayFolder[];
  override: unknown;
  fetchedAt: number;
};

/**
 * Cached reads of Google. Each is cached for `refresh.sourceMinutes` (profile "source" in
 * next.config.ts) with a long expiry, so a stale copy keeps being served while a refresh
 * runs, and a failed refresh leaves the old copy in place. `remote` shares the cache across
 * server instances. Arguments are part of the cache key; they never reach the browser.
 */
/** Cache tags on the Google reads; /api/refresh revalidates them all. */
export const SOURCE_TAGS = {
  drive: "drive",
  calendar: "calendar",
  weather: "weather",
} as const;

type HolidayFolder = {
  name: string;
  entries: DriveEntry[];
} & ({ rule: HolidayRule; window?: undefined } | { rule?: undefined; window: DateWindow });

/** The folders inside "Holidays" whose names are understood, with their contents. */
async function loadHolidayFolders(folderId: string, today: string): Promise<HolidayFolder[]> {
  const listing = await listFolder(folderId);
  if (!listing.recognized) throw new Error(`Drive subfolder page not recognised ("${HOLIDAYS_FOLDER}")`);
  const out: HolidayFolder[] = [];
  for (const f of listing.entries.filter((e) => e.isFolder)) {
    const rule = parseHolidayRule(stripLabel(f.name));
    let when: { rule: HolidayRule } | { window: DateWindow };
    if (rule) when = { rule };
    else {
      const parsed = parseFolderName(f.name);
      if (!parsed.ok) {
        console.warn(`[drive] ignoring holiday folder "${f.name}": not a holiday date or ${parsed.reason}`);
        continue;
      }
      if (parsed.window.end && parsed.window.end < addDays(today, -1)) continue;
      when = { window: parsed.window };
    }
    const sub = await listFolder(f.id);
    if (!sub.recognized) throw new Error(`Drive subfolder page not recognised ("${f.name}")`);
    out.push({ name: f.name, entries: sub.entries, ...when });
  }
  return out;
}

const DRIVE_REREAD_COOLDOWN_MS = 60_000;
let lastDriveReread = 0;

/**
 * A listed image couldn't be fetched from Google (moved out of the folder, or deleted), so
 * the cached listing is probably out of date: expire it so the next read lists Drive again.
 * At most once a minute per server instance. Returns whether it expired the listing.
 */
export function rereadDriveSoon(now = Date.now()): boolean {
  if (now - lastDriveReread < DRIVE_REREAD_COOLDOWN_MS) return false;
  lastDriveReread = now;
  revalidateTag(SOURCE_TAGS.drive, { expire: 0 });
  return true;
}

async function loadDrive(
  folderId: string,
  timezone: string,
): Promise<DriveSnapshot> {
  "use cache: remote";
  cacheLife("source");
  cacheTag(SOURCE_TAGS.drive);

  const rootListing = await listFolder(folderId);
  if (!rootListing.recognized) {
    throw new Error(
      "Drive folder page not recognised; keeping the previous listing",
    );
  }
  const today = dayInTz(Date.now(), timezone);
  const folders: DriveSnapshot["folders"] = [];
  let emergency: DriveEntry[] = [];
  let holidays: HolidayFolder[] = [];
  for (const f of rootListing.entries.filter((e) => e.isFolder)) {
    if (isHolidaysFolder(f.name)) {
      holidays = holidays.concat(await loadHolidayFolders(f.id, today));
      continue;
    }
    if (isEmergencyFolder(f.name)) {
      const listing = await listFolder(f.id);
      if (!listing.recognized)
        throw new Error(`Drive subfolder page not recognised ("${f.name}")`);
      emergency = emergency.concat(listing.entries);
      continue;
    }
    const parsed = parseFolderName(f.name);
    if (!parsed.ok) {
      console.warn(`[drive] ignoring folder "${f.name}": ${parsed.reason}`);
      continue;
    }
    // A day of margin so a Drive-side timezone override can't drop a folder early.
    if (parsed.window.end && parsed.window.end < addDays(today, -1)) continue;
    const listing = await listFolder(f.id);
    if (!listing.recognized)
      throw new Error(`Drive subfolder page not recognised ("${f.name}")`);
    folders.push({
      name: f.name,
      window: parsed.window,
      entries: listing.entries,
    });
  }
  const override = await readOverride(rootListing.entries, downloadText);
  return {
    root: rootListing.entries,
    emergency,
    folders,
    holidays,
    override,
    fetchedAt: Date.now(),
  };
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
  const file = entries.find(
    (e) => !e.isFolder && e.name.toLowerCase() === "config.json",
  );
  if (!file) return null;
  try {
    return parseOverrideText(await download(file.id));
  } catch (err) {
    console.warn(
      `[config] could not read Drive config.json; ignored: ${(err as Error).message}`,
    );
    return null;
  }
}

async function loadCalendar(
  calendarId: string,
  fetchDays: number,
  timezone: string,
) {
  "use cache: remote";
  cacheLife("source");
  cacheTag(SOURCE_TAGS.calendar);
  return {
    events: await fetchEvents(calendarId, fetchDays, timezone),
    fetchedAt: Date.now(),
  };
}

async function loadWeather(
  latitude: number,
  longitude: number,
  timezone: string,
  units: WeatherUnits,
) {
  "use cache: remote";
  cacheLife("source");
  cacheTag(SOURCE_TAGS.weather);
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
async function resilient<T>(
  key: string,
  load: () => Promise<T>,
): Promise<T | null> {
  try {
    const v = await load();
    lastGood.set(key, v);
    return v;
  } catch (err) {
    console.error(
      `[playlist] ${key} refresh failed: ${(err as Error).message}`,
    );
    return (lastGood.get(key) as T | undefined) ?? null;
  }
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });

/** The root subfolder whose images replace everything else while it has any. */
export const EMERGENCY_FOLDER = "Emergency Override";
export const isEmergencyFolder = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase() ===
  EMERGENCY_FOLDER.toLowerCase();

/** The root subfolder holding one folder per holiday. */
export const HOLIDAYS_FOLDER = "Holidays";
export const isHolidaysFolder = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase() === HOLIDAYS_FOLDER.toLowerCase();

/**
 * Pure assembly of the image list: holidays first (soonest holiday first, then the
 * "Holidays" folders with ordinary date names, by name), then root, then folders by name;
 * ended windows dropped. If the Emergency Override folder has images, the list is only
 * those (by name), always shown.
 */
export function assembleImages(
  snapshot: Pick<DriveSnapshot, "root" | "folders" | "holidays"> & {
    emergency?: DriveEntry[];
  },
  today: string,
  holidayDays: CoreSettings["holidays"] = defaultSettings.holidays,
): PlaylistImage[] {
  const images: PlaylistImage[] = [];
  const add = (entries: DriveEntry[], w: DateWindow) => {
    for (const e of entries.filter(isImageEntry).sort(byName)) {
      images.push({
        id: e.id,
        name: e.name,
        start: w.start,
        end: w.end,
        ...(w.yearly ? { yearly: w.yearly } : {}),
        ...(w.holiday ? { holiday: w.holiday } : {}),
        ...(e.modified ? { version: fileVersion(e.modified) } : {}),
      });
    }
  };
  const emergency = (snapshot.emergency ?? []).filter(isImageEntry);
  if (emergency.length > 0) {
    add(emergency, { start: null, end: null });
    return images;
  }
  const holidays = (snapshot.holidays ?? []).map((h) => {
    if (!h.rule) return { h, window: h.window, sortKey: "~" };
    const holiday = { rule: h.rule, before: holidayDays.daysBefore, after: holidayDays.daysAfter };
    const window: DateWindow = { start: null, end: null, holiday };
    return { h, window, sortKey: holidayOccurrence(holiday, today)?.date ?? "~" };
  });
  // Plain comparison: dates sort as text, and "~" (no date) sorts after them.
  holidays.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : byName(a.h, b.h)));
  for (const { h, window } of holidays) {
    if (window.end !== null && window.end < today) continue;
    add(h.entries, window);
  }
  add(snapshot.root, { start: null, end: null });
  for (const f of [...snapshot.folders].sort(byName)) {
    if (f.window.end !== null && f.window.end < today) continue;
    add(f.entries, f.window);
  }
  return images;
}

export async function getImageIds(): Promise<Set<string>> {
  const env = getEnv();
  const folderId = env.driveFolderId;
  if (!folderId) return new Set();
  const drive = await resilient("drive", () =>
    loadDrive(folderId, env.timezone),
  );
  if (!drive) return new Set();
  return new Set(
    assembleImages(drive, dayInTz(Date.now(), env.timezone)).map((i) => i.id),
  );
}

/**
 * The forecast, or null when weather is off, has no location, or has never loaded. Never throws.
 * A configured location whose lookup or forecast failed with no earlier copy marks "weather" degraded.
 */
async function loadWeatherSource(
  config: Settings,
  degraded: Playlist["degraded"],
): Promise<{ weather: PlaylistWeather | null; status: SourceStatus }> {
  if (!config.weather.enabled) return { weather: null, status: "disabled" };
  const location = getWeatherLocation();
  if (!location) return { weather: null, status: "unconfigured" };
  const { timezone } = config;
  const units = config.weather.units;
  let coords: { latitude: number; longitude: number } | null;
  if (location.kind === "coords") coords = location;
  else {
    coords = await resilient("location", () =>
      loadLocation(location.zip, location.country),
    );
    if (!coords)
      console.warn(
        "[weather] could not resolve WEATHER_ZIP; weather disabled until it can",
      );
  }
  const weather = coords
    ? await resilient("weather", () =>
        loadWeather(coords.latitude, coords.longitude, timezone, units),
      )
    : null;
  if (!weather) degraded.push("weather");
  return { weather, status: weather ? "ok" : "error" };
}

export async function getPlaylist(): Promise<Playlist> {
  const env = getEnv();
  const now = Date.now();
  const degraded: Playlist["degraded"] = [];

  // A source without its env var is simply off (not degraded): the screen explains it.
  const folderId = env.driveFolderId;
  const drive = folderId
    ? await resilient("drive", () => loadDrive(folderId, env.timezone))
    : null;
  if (folderId && !drive) degraded.push("drive");
  const config = buildSettings(env.timezone, drive?.override ?? null);

  const calendarId = env.calendarId;
  const cal = calendarId
    ? await resilient("calendar", () =>
        loadCalendar(calendarId, config.calendar.fetchDays, config.timezone),
      )
    : null;
  if (calendarId && !cal) degraded.push("calendar");

  const { weather, status: weatherStatus } = await loadWeatherSource(
    config,
    degraded,
  );

  const events: PlaylistEvent[] = (cal?.events ?? []).filter(
    (e) => e.end >= now,
  );
  const images = drive
    ? assembleImages(drive, dayInTz(now, config.timezone), config.holidays)
    : [];
  const emergency = !!drive && (drive.emergency ?? []).some(isImageEntry);
  return {
    images,
    events,
    config,
    weather,
    serverTime: now,
    degraded,
    release: currentRelease(),
    ...(emergency ? { emergency: true } : {}),
    sources: {
      drive: !folderId
        ? "unconfigured"
        : !drive
          ? "error"
          : images.length
            ? "ok"
            : "empty",
      calendar: !calendarId
        ? "unconfigured"
        : !cal
          ? "error"
          : events.length
            ? "ok"
            : "empty",
      weather: weatherStatus,
    },
  };
}
