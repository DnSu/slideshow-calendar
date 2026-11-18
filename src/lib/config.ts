import { z } from "zod";
import defaultsJson from "../../slideshow.config.json";
import { isValidTimezone } from "./dates";
import { GOOGLE_DOC_MIME, type DriveEntry } from "./drive";
import { parseSettingsText, settingLabel, settingsText } from "./settingsText";

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
  holidays: z.object({
    daysBefore: int(0, 60),
    daysAfter: int(0, 60),
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
  /** How problems name a setting: `"slideshow.imageSeconds"` for config.json, the Doc name for the settings Doc. */
  label: (path: string) => string = (path) => `"${path}"`,
): { settings: CoreSettings; problems: string[] } {
  const problems: string[] = [];
  const out = structuredClone(base) as Record<string, Record<string, unknown>>;
  if (override === null || override === undefined)
    return { settings: base, problems };
  if (!isRecord(override)) {
    return {
      settings: base,
      problems: ["config.json must contain a JSON object"],
    };
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
        problems.push(`${label(path)} cannot be set from Drive; ignored`);
      } else if (!Object.hasOwn(shape, key)) {
        problems.push(`unknown setting ${label(path)}; ignored`);
      } else {
        const r = shape[key].safeParse(value);
        if (r.success) out[section][key] = r.data;
        else problems.push(`invalid value for ${label(path)}; using default`);
      }
    }
  }
  for (const key of Object.keys(override)) {
    if (!Object.hasOwn(schema.shape, key) && key !== "timezone")
      problems.push(`unknown setting ${label(key)}; ignored`);
  }
  const merged = out as unknown as CoreSettings;
  return { settings: merged, problems };
}

/** Deployment settings. A missing ID turns that source off (the screen explains why); it isn't an error. */
export type Env = {
  driveFolderId: string | null;
  calendarId: string | null;
  timezone: string;
};

/** Reads and validates environment variables. Throws a clear error if one is missing. */
export function getEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  for (const k of ["DRIVE_FOLDER_ID", "CALENDAR_ID"]) {
    if (!source[k]?.trim())
      console.warn(
        `[config] ${k} is not set; that source is off. See .env.example.`,
      );
  }
  let timezone = source.TIMEZONE?.trim() || "UTC";
  if (!isValidTimezone(timezone)) {
    console.warn(
      `[config] TIMEZONE "${timezone}" is not a valid IANA timezone; using UTC`,
    );
    timezone = "UTC";
  }
  return {
    driveFolderId: source.DRIVE_FOLDER_ID?.trim() || null,
    calendarId: source.CALENDAR_ID?.trim() || null,
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
export function buildSettings(
  envTimezone: string,
  override: unknown,
): Settings {
  let merged: ReturnType<typeof mergeSettings>;
  try {
    merged = mergeSettings(defaultSettings, override);
  } catch (err) {
    // Belt and braces: a Drive file must never take the screens down.
    console.warn(
      `[config] Drive config.json could not be applied; using defaults: ${(err as Error).message}`,
    );
    return { ...defaultSettings, timezone: envTimezone };
  }
  const { settings, problems } = merged;
  for (const p of problems) console.warn(`[config] ${p}`);
  let timezone = envTimezone;
  if (isRecord(override) && override.timezone !== undefined) {
    if (
      typeof override.timezone === "string" &&
      isValidTimezone(override.timezone)
    ) {
      timezone = override.timezone;
    } else {
      console.warn(
        '[config] invalid "timezone" in Drive config.json; using default',
      );
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
  if (latitude !== null && longitude !== null)
    return { kind: "coords", latitude, longitude };
  if (source.WEATHER_LATITUDE?.trim() || source.WEATHER_LONGITUDE?.trim()) {
    console.warn(
      "[config] WEATHER_LATITUDE / WEATHER_LONGITUDE must both be valid numbers; ignored",
    );
  }
  const zip = source.WEATHER_ZIP?.trim();
  if (!zip) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{0,19}$/.test(zip)) {
    console.warn(
      "[config] WEATHER_ZIP is not a valid postal code; weather disabled",
    );
    return null;
  }
  let country = source.WEATHER_COUNTRY?.trim().toUpperCase() || "US";
  if (!/^[A-Z]{2}$/.test(country)) {
    console.warn(
      '[config] WEATHER_COUNTRY must be a 2-letter country code; using "US"',
    );
    country = "US";
  }
  return { kind: "zip", zip, country };
}

/** The settings file found in the Drive folder's main folder, as read by the server. */
export type ConfigSource = {
  /** "doc": a Google Doc named "config"; "txt": config.txt; "json": config.json. */
  kind: "doc" | "txt" | "json";
  /** As people see it in Drive. */
  name: string;
  /** Its text, or null if it couldn't be read. */
  text: string | null;
  /** Other settings files in the folder, which are ignored (only one is used). */
  ignored: string[];
};

/** What's wrong with the Drive settings file, plus a corrected Doc to paste over it. */
export type ConfigFileCheck = {
  /** The file, as people see it in Drive. */
  name: string;
  kind: ConfigSource["kind"];
  /** Mistakes: the file (or parts of it) is ignored. */
  problems: string[];
  /** Settings the file doesn't list (it's older than them, or they were left out); defaults apply. */
  missing: string[];
  /** A suggestion that isn't a mistake (e.g. switch from config.json to the Google Doc). */
  note?: string;
  /** The whole settings Doc: the file's valid values kept, everything else at its default. */
  fixed: string;
};

/**
 * Read a settings file's text: JSON if it starts with "{" (config.json, or JSON pasted into
 * the Doc), else the friendly NAME = value format. Never throws.
 */
export function readConfigText(text: string | null): {
  override: unknown;
  format: "json" | "lines";
  problems: string[];
} {
  if (text === null)
    return { override: null, format: "lines", problems: ["couldn't be read from Drive (is the folder still shared?)"] };
  const t = text.replace(/^\uFEFF/, "").trim();
  if (t.startsWith("<"))
    return { override: null, format: "lines", problems: ["couldn't be read from Drive (is the folder still shared?)"] };
  if (t.startsWith("{")) {
    const override = parseOverrideText(t);
    return override === null
      ? {
          override,
          format: "json",
          problems: ["has a mistake in its JSON (a missing comma, quote or bracket?), so all of it is ignored"],
        }
      : { override, format: "json", problems: [] };
  }
  const { override, problems } = parseSettingsText(t);
  return { override, format: "lines", problems };
}

/** The settings from a Drive settings file (null: none). Never throws. */
export function overrideFrom(source: ConfigSource | null): unknown {
  return source ? readConfigText(source.text).override : null;
}

/** Check the Drive settings file. Returns null when there's none or nothing to report. */
export function checkConfigFile(source: ConfigSource | null): ConfigFileCheck | null {
  if (!source) return null;
  const read = readConfigText(source.text);
  const label = read.format === "json" ? (p: string) => `"${p}"` : settingLabel;
  const problems = [...read.problems];
  for (const name of source.ignored) problems.push(`${name} is ignored, because ${source.name} is used; delete one of them`);
  const missing: string[] = [];
  let settings = defaultSettings;
  let timezone: string | undefined;
  const override = read.override;
  if (isRecord(override)) {
    const merged = mergeSettings(defaultSettings, override, label);
    settings = merged.settings;
    problems.push(...merged.problems);
    if (override.timezone !== undefined) {
      if (typeof override.timezone === "string" && isValidTimezone(override.timezone))
        timezone = override.timezone;
      else problems.push(`invalid value for ${label("timezone")}; using default`);
    }
    for (const [section, sectionSchema] of Object.entries(schema.shape)) {
      const given = override[section];
      for (const key of Object.keys(sectionSchema.shape)) {
        const path = `${section}.${key}`;
        if (ENV_ONLY.has(path)) continue;
        if (!isRecord(given) || !Object.hasOwn(given, key)) missing.push(label(path).replace(/"/g, ""));
      }
    }
  } else if (override !== null && override !== undefined) {
    problems.push("doesn't contain settings, so it's ignored");
  }
  const note =
    source.kind === "doc"
      ? undefined
      : `${source.name} still works, but a Google Doc named "config" is easier to edit: make one in the main folder, paste the fixed settings into it, then delete ${source.name}`;
  if (!problems.length && !missing.length && !note) return null;
  return {
    name: source.name,
    kind: source.kind,
    problems,
    missing,
    ...(note ? { note } : {}),
    fixed: settingsText(settings, timezone),
  };
}

/** Which settings file a Drive entry is, if any (only the main folder's are used). */
export function configKind(e: DriveEntry): ConfigSource["kind"] | null {
  if (e.isFolder) return null;
  const name = e.name.trim().toLowerCase();
  if (e.mime === GOOGLE_DOC_MIME) return name === "config" ? "doc" : null;
  if (name === "config.txt") return "txt";
  if (name === "config.json") return "json";
  return null;
}
