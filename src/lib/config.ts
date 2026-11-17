import { z } from "zod";
import defaultsJson from "../../slideshow.config.json";
import { isValidTimezone } from "./dates";

const int = (min: number, max: number) => z.number().int().min(min).max(max);

const schema = z.object({
  slideshow: z.object({
    imageSeconds: z.number().min(1).max(3600),
    imageFit: z.enum(["contain", "cover"]),
    transitionMs: int(0, 10_000),
  }),
  calendar: z.object({
    showAfterImages: int(1, 100),
    displaySeconds: z.number().min(5).max(3600),
    fetchDays: int(1, 365),
    eventsPerPage: int(1, 50),
    title: z.string().min(1).max(80),
  }),
  refresh: z.object({
    sourceMinutes: int(1, 1440),
    playlistMinutes: int(1, 1440),
    pageReloadHours: z.number().min(1).max(168),
  }),
  offline: z.object({ showIndicator: z.boolean() }),
  weather: z.object({
    enabled: z.boolean(),
    units: z.enum(["fahrenheit", "celsius"]),
    displaySeconds: z.number().min(5).max(3600),
    title: z.string().min(1).max(80),
  }),
});

export type CoreSettings = z.infer<typeof schema>;
export type Settings = CoreSettings & { timezone: string };

/** Code defaults. Throws at import time if slideshow.config.json is invalid. */
export const defaultSettings: CoreSettings = schema.parse(defaultsJson);

/** Settings that Drive's config.json may not change. */
const ENV_ONLY = new Set(["refresh.sourceMinutes"]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Apply a Drive config.json override on top of `base`. Each value is validated on its
 * own; a bad value keeps the base value. Never throws. `problems` lists what was ignored.
 */
export function mergeSettings(
  base: CoreSettings,
  override: unknown,
): { settings: CoreSettings; problems: string[] } {
  const problems: string[] = [];
  const out = structuredClone(base) as Record<string, Record<string, unknown>>;
  if (override === null || override === undefined) return { settings: base, problems };
  if (!isRecord(override)) {
    return { settings: base, problems: ["config.json must contain a JSON object"] };
  }
  for (const [section, sectionSchema] of Object.entries(schema.shape)) {
    const given = override[section];
    if (given === undefined) continue;
    if (!isRecord(given)) {
      problems.push(`"${section}" must be an object`);
      continue;
    }
    const shape = sectionSchema.shape as Record<string, z.ZodType>;
    for (const [key, value] of Object.entries(given)) {
      const path = `${section}.${key}`;
      if (ENV_ONLY.has(path)) {
        problems.push(`"${path}" cannot be set from Drive; ignored`);
      } else if (!Object.hasOwn(shape, key)) {
        problems.push(`unknown setting "${path}"; ignored`);
      } else {
        const r = shape[key].safeParse(value);
        if (r.success) out[section][key] = r.data;
        else problems.push(`invalid value for "${path}"; using default`);
      }
    }
  }
  for (const key of Object.keys(override)) {
    if (!Object.hasOwn(schema.shape, key) && key !== "timezone") problems.push(`unknown setting "${key}"; ignored`);
  }
  const merged = out as unknown as CoreSettings;
  return { settings: merged, problems };
}

export type Env = { driveFolderId: string; calendarId: string; timezone: string };

/** Reads and validates environment variables. Throws a clear error if one is missing. */
export function getEnv(source: Record<string, string | undefined> = process.env): Env {
  const missing = ["DRIVE_FOLDER_ID", "CALENDAR_ID"].filter((k) => !source[k]?.trim());
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. See .env.example.`,
    );
  }
  let timezone = source.TIMEZONE?.trim() || "UTC";
  if (!isValidTimezone(timezone)) {
    console.warn(`[config] TIMEZONE "${timezone}" is not a valid IANA timezone; using UTC`);
    timezone = "UTC";
  }
  return {
    driveFolderId: source.DRIVE_FOLDER_ID!.trim(),
    calendarId: source.CALENDAR_ID!.trim(),
    timezone,
  };
}

/** Parse the text of a Drive config.json. Invalid JSON gives `null` (defaults are used). */
export function parseOverrideText(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    console.warn("[config] Drive config.json is not valid JSON; ignored");
    return null;
  }
}

/** Full settings: defaults + optional Drive override + timezone from env (or override). */
export function buildSettings(envTimezone: string, override: unknown): Settings {
  let merged: ReturnType<typeof mergeSettings>;
  try {
    merged = mergeSettings(defaultSettings, override);
  } catch (err) {
    // Belt and braces: a Drive file must never take the screens down.
    console.warn(`[config] Drive config.json could not be applied; using defaults: ${(err as Error).message}`);
    return { ...defaultSettings, timezone: envTimezone };
  }
  const { settings, problems } = merged;
  for (const p of problems) console.warn(`[config] ${p}`);
  let timezone = envTimezone;
  if (isRecord(override) && override.timezone !== undefined) {
    if (typeof override.timezone === "string" && isValidTimezone(override.timezone)) {
      timezone = override.timezone;
    } else {
      console.warn('[config] invalid "timezone" in Drive config.json; using default');
    }
  }
  return { ...settings, timezone };
}

/** Where the weather is for. Deployment data: read from env only, never sent to the browser. */
export type WeatherLocation =
  | { kind: "coords"; latitude: number; longitude: number }
  | { kind: "zip"; zip: string; country: string };

function coordinate(raw: string | undefined, limit: number): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/**
 * Weather location from the environment. Precedence: WEATHER_LATITUDE + WEATHER_LONGITUDE
 * (both set and valid), then WEATHER_ZIP (+ WEATHER_COUNTRY, default US), else null (no weather).
 */
export function getWeatherLocation(
  source: Record<string, string | undefined> = process.env,
): WeatherLocation | null {
  const latitude = coordinate(source.WEATHER_LATITUDE, 90);
  const longitude = coordinate(source.WEATHER_LONGITUDE, 180);
  if (latitude !== null && longitude !== null) return { kind: "coords", latitude, longitude };
  if (source.WEATHER_LATITUDE?.trim() || source.WEATHER_LONGITUDE?.trim()) {
    console.warn("[config] WEATHER_LATITUDE / WEATHER_LONGITUDE must both be valid numbers; ignored");
  }
  const zip = source.WEATHER_ZIP?.trim();
  if (!zip) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{0,19}$/.test(zip)) {
    console.warn("[config] WEATHER_ZIP is not a valid postal code; weather disabled");
    return null;
  }
  let country = source.WEATHER_COUNTRY?.trim().toUpperCase() || "US";
  if (!/^[A-Z]{2}$/.test(country)) {
    console.warn('[config] WEATHER_COUNTRY must be a 2-letter country code; using "US"');
    country = "US";
  }
  return { kind: "zip", zip, country };
}
