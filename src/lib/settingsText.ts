import type { CoreSettings } from "./config";

/**
 * The friendly settings format for the Drive "config" Google Doc (or config.txt): one
 * `NAME = value` per line, `#` for notes, no quotes or brackets needed. Forgiving on
 * purpose: names ignore case and spaces/underscores/dashes, values may be quoted (straight
 * or curly), yes/no work for on/off, and a mistake only loses its own line.
 * docs/config.txt is `settingsText(defaultSettings)` (a test keeps them equal).
 */

type Kind =
  | { type: "number"; /** Doc value × scale = setting value (seconds → ms). */ scale?: number }
  | { type: "yesno" }
  | { type: "choice"; choices: string[] }
  | { type: "text" };

export type SettingField = {
  /** Path in CoreSettings, or "timezone". */
  path: string;
  /** Name in the Doc. */
  name: string;
  kind: Kind;
  /** One line for people, shown above the setting in the Doc. */
  note: string;
};

type Group = { title: string; fields: SettingField[] };

const num = (scale?: number): Kind => ({ type: "number", ...(scale ? { scale } : {}) });

export const SETTING_GROUPS: Group[] = [
  {
    title: "Pictures",
    fields: [
      { path: "slideshow.imageSeconds", name: "PICTURE_SECONDS", kind: num(), note: "How long each picture stays on screen, in seconds." },
      {
        path: "slideshow.imageFit",
        name: "PICTURE_FIT",
        kind: { type: "choice", choices: ["cover", "contain"] },
        note: "cover fills the screen and trims the edges; contain shows the whole picture with black bars.",
      },
      { path: "slideshow.transitionMs", name: "FADE_SECONDS", kind: num(1000), note: "How long the fade between pictures takes, in seconds (0.5 is half a second)." },
    ],
  },
  {
    title: "Calendar",
    fields: [
      { path: "calendar.showAfterImages", name: "CALENDAR_AFTER_PICTURES", kind: num(), note: "How many pictures play before the calendar shows." },
      { path: "calendar.displaySeconds", name: "CALENDAR_SECONDS", kind: num(), note: "How long each calendar page stays on screen, in seconds." },
      { path: "calendar.fetchDays", name: "CALENDAR_DAYS_AHEAD", kind: num(), note: "How many days ahead to list events." },
      { path: "calendar.eventsPerPage", name: "EVENTS_PER_PAGE", kind: num(), note: "The most events on one calendar page; more events make more pages." },
      { path: "calendar.title", name: "CALENDAR_TITLE", kind: { type: "text" }, note: "The heading at the top of the calendar." },
    ],
  },
  {
    title: "Weather",
    fields: [
      { path: "weather.enabled", name: "SHOW_WEATHER", kind: { type: "yesno" }, note: "Show the weather page (yes or no)." },
      {
        path: "weather.units",
        name: "WEATHER_UNITS",
        kind: { type: "choice", choices: ["fahrenheit", "celsius"] },
        note: "fahrenheit or celsius.",
      },
      { path: "weather.displaySeconds", name: "WEATHER_SECONDS", kind: num(), note: "How long the weather stays on screen, in seconds." },
      { path: "weather.title", name: "WEATHER_TITLE", kind: { type: "text" }, note: "The heading at the top of the weather page." },
    ],
  },
  {
    title: "Holidays",
    fields: [
      { path: "holidays.daysBefore", name: "HOLIDAY_DAYS_BEFORE", kind: num(), note: "How many days before a holiday its pictures start showing." },
      { path: "holidays.daysAfter", name: "HOLIDAY_DAYS_AFTER", kind: num(), note: "How many days after a holiday its pictures keep showing." },
    ],
  },
  {
    title: "Screens",
    fields: [
      { path: "refresh.playlistMinutes", name: "CHECK_FOR_CHANGES_MINUTES", kind: num(), note: "How often the screens check for changes, in minutes." },
      { path: "refresh.pageReloadHours", name: "RESTART_PAGE_HOURS", kind: num(), note: "How often the screens fully restart the page, in hours." },
      { path: "offline.showIndicator", name: "SHOW_OFFLINE_DOT", kind: { type: "yesno" }, note: "Show a small orange dot when a screen loses its internet connection (yes or no)." },
    ],
  },
];

export const TIMEZONE_FIELD: SettingField = {
  path: "timezone",
  name: "TIMEZONE",
  kind: { type: "text" },
  note: "Time zone, like America/New_York. Normally set with the website; only add this line to change it.",
};

export const SETTING_FIELDS: SettingField[] = [...SETTING_GROUPS.flatMap((g) => g.fields), TIMEZONE_FIELD];

const normName = (s: string) => s.trim().toUpperCase().replace(/[\s_-]+/g, "_");
const BY_NAME = new Map(SETTING_FIELDS.map((f) => [normName(f.name), f]));
const BY_PATH = new Map(SETTING_FIELDS.map((f) => [f.path, f]));

/** How a problem names a setting: by its Doc name. */
export const settingLabel = (path: string) => BY_PATH.get(path)?.name ?? path;

/** Undo what Google Docs and copy-paste do to text: BOM, curly quotes, non-breaking spaces. */
function normalize(text: string): string {
  return text
    .replace(/^﻿/, "")
    .replace(/[“”„″]/g, '"')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[   ]/g, " ")
    .replace(/\r\n?/g, "\n");
}

const unquote = (v: string) => {
  const m = /^(["'])(.*)\1$/.exec(v);
  return m ? m[2] : v;
};

const YES = new Set(["yes", "y", "true", "on", "1"]);
const NO = new Set(["no", "n", "false", "off", "0"]);

/** The value for `field`, or a plain-words problem. */
function convert(field: SettingField, raw: string): { value: unknown } | { problem: string } {
  const v = unquote(raw.trim()).trim();
  const k = field.kind;
  if (v === "") return { problem: `${field.name} has no value; using the default` };
  if (k.type === "number") {
    const m = /^(-?\d+(?:\.\d+)?)\s*[a-z ]*$/i.exec(v.replace(/(\d),(?=\d{3}\b)/g, "$1"));
    if (!m) return { problem: `${field.name} should be a number, not "${v}"; using the default` };
    return { value: Math.round(Number(m[1]) * (k.scale ?? 1) * 1000) / 1000 };
  }
  if (k.type === "yesno") {
    const w = v.toLowerCase();
    if (YES.has(w)) return { value: true };
    if (NO.has(w)) return { value: false };
    return { problem: `${field.name} should be yes or no, not "${v}"; using the default` };
  }
  if (k.type === "choice") {
    const w = v.toLowerCase();
    if (k.choices.includes(w)) return { value: w };
    return { problem: `${field.name} should be ${k.choices.join(" or ")}, not "${v}"; using the default` };
  }
  return { value: v };
}

/**
 * Parse the friendly format into the same shape as a config.json override, plus problems in
 * plain words. Never throws. Range checks happen later, in mergeSettings.
 */
export function parseSettingsText(text: string): { override: Record<string, unknown>; problems: string[] } {
  const override: Record<string, unknown> = {};
  const problems: string[] = [];
  const seen = new Set<string>();
  normalize(text)
    .split("\n")
    .forEach((rawLine, i) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || line.startsWith("//")) return;
      const m = /^([A-Za-z][A-Za-z0-9 _-]*?)\s*[=:]\s*(.*)$/.exec(line);
      if (!m) {
        problems.push(`line ${i + 1} ("${shorten(line)}") isn't in the form NAME = value; it's ignored`);
        return;
      }
      const field = BY_NAME.get(normName(m[1]));
      if (!field) {
        problems.push(`line ${i + 1}: there's no setting called ${normName(m[1])}; it's ignored`);
        return;
      }
      if (seen.has(field.name)) problems.push(`${field.name} is set more than once; the last one is used`);
      seen.add(field.name);
      const r = convert(field, m[2]);
      if ("problem" in r) {
        problems.push(r.problem);
        return;
      }
      const [section, key] = field.path.split(".");
      if (!key) override[section] = r.value;
      else {
        const s = (override[section] ??= {}) as Record<string, unknown>;
        s[key] = r.value;
      }
    });
  return { override, problems };
}

const shorten = (s: string) => (s.length > 40 ? `${s.slice(0, 37)}…` : s);

function show(field: SettingField, value: unknown): string {
  if (field.kind.type === "yesno") return value ? "yes" : "no";
  if (field.kind.type === "number") return String(Number(value) / (field.kind.scale ?? 1));
  return String(value);
}

/** The whole settings Doc for `settings` (+ an active TIMEZONE line if `timezone` is given). */
export function settingsText(settings: CoreSettings, timezone?: string): string {
  const values = settings as unknown as Record<string, Record<string, unknown>>;
  const out = [
    "# Settings for the lobby screens.",
    "# Change the value after the = sign. Lines starting with # are notes.",
    "# Delete a line to use the built-in value. Changes show within about",
    "# an hour and a half, or about 10 minutes after pressing the refresh",
    "# button on the website's /slideshow page.",
  ];
  for (const g of SETTING_GROUPS) {
    out.push("", `# ---- ${g.title} ----`);
    for (const f of g.fields) {
      const [section, key] = f.path.split(".");
      out.push("", `# ${f.note}`, `${f.name} = ${show(f, values[section][key])}`);
    }
  }
  out.push("", `# ${TIMEZONE_FIELD.note}`, timezone ? `TIMEZONE = ${timezone}` : "# TIMEZONE = America/New_York");
  return out.join("\n") + "\n";
}
