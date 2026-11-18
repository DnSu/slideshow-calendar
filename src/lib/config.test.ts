import { describe, expect, it, vi } from "vitest";
import {
  buildSettings,
  checkConfigFile,
  overrideFrom,
  type ConfigSource,
  defaultSettings,
  getEnv,
  getWeatherLocation,
  mergeSettings,
  parseOverrideText,
} from "@/lib/config";

describe("getEnv", () => {
  it("treats a missing or blank ID as that source being off (no error)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getEnv({})).toMatchObject({ driveFolderId: null, calendarId: null });
    expect(getEnv({ DRIVE_FOLDER_ID: " x1 ", CALENDAR_ID: " " })).toMatchObject(
      {
        driveFolderId: "x1",
        calendarId: null,
      },
    );
  });
  it("defaults and validates the timezone", () => {
    const base = {
      DRIVE_FOLDER_ID: "fake-folder",
      CALENDAR_ID: "fake@example.invalid",
    };
    expect(getEnv(base).timezone).toBe("UTC");
    expect(getEnv({ ...base, TIMEZONE: "Europe/Paris" }).timezone).toBe(
      "Europe/Paris",
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getEnv({ ...base, TIMEZONE: "Nowhere/Land" }).timezone).toBe("UTC");
  });
});

describe("mergeSettings", () => {
  it("returns defaults with no override", () => {
    expect(mergeSettings(defaultSettings, null).settings).toEqual(
      defaultSettings,
    );
  });
  it("applies valid values and leaves the rest", () => {
    const { settings, problems } = mergeSettings(defaultSettings, {
      slideshow: { imageSeconds: 10, imageFit: "cover" },
      calendar: { title: "What's On" },
    });
    expect(problems).toEqual([]);
    expect(settings.slideshow).toEqual({
      ...defaultSettings.slideshow,
      imageSeconds: 10,
      imageFit: "cover",
    });
    expect(settings.calendar.title).toBe("What's On");
    expect(settings.calendar.eventsPerPage).toBe(
      defaultSettings.calendar.eventsPerPage,
    );
  });
  it("falls back per value on bad values", () => {
    const { settings, problems } = mergeSettings(defaultSettings, {
      slideshow: { imageSeconds: -5, imageFit: "stretch", transitionMs: 500 },
      calendar: "nope",
      offline: { showIndicator: "yes" },
      bogus: 1,
    });
    expect(settings.slideshow.imageSeconds).toBe(20);
    expect(settings.slideshow.imageFit).toBe("cover");
    expect(settings.slideshow.transitionMs).toBe(500);
    expect(settings.offline.showIndicator).toBe(true);
    expect(problems.length).toBe(5);
  });
  it("never lets Drive change refresh.sourceMinutes", () => {
    const { settings, problems } = mergeSettings(defaultSettings, {
      refresh: { sourceMinutes: 1, playlistMinutes: 5 },
    });
    expect(settings.refresh.sourceMinutes).toBe(60);
    expect(settings.refresh.playlistMinutes).toBe(5);
    expect(problems.join()).toMatch(/sourceMinutes/);
  });
  it("ignores a non-object override", () => {
    expect(mergeSettings(defaultSettings, [1, 2]).settings).toEqual(
      defaultSettings,
    );
  });
  it("ignores the removed daysAhead/maxEvents settings", () => {
    const r = mergeSettings(defaultSettings, {
      calendar: { daysAhead: 30, maxEvents: 4 },
    });
    expect(r.settings.calendar).toEqual(defaultSettings.calendar);
    expect(r.problems).toHaveLength(2);
  });
});

describe("buildSettings / parseOverrideText", () => {
  it("lets Drive override the timezone only if valid", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(buildSettings("UTC", { timezone: "Asia/Tokyo" }).timezone).toBe(
      "Asia/Tokyo",
    );
    expect(buildSettings("UTC", { timezone: "bad" }).timezone).toBe("UTC");
    expect(buildSettings("Europe/Paris", null).timezone).toBe("Europe/Paris");
  });
  it("treats invalid JSON as no override", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseOverrideText("{ nope")).toBeNull();
    expect(parseOverrideText('﻿{"a":1}')).toEqual({ a: 1 });
  });
});

describe("weather settings", () => {
  it("has defaults", () => {
    expect(defaultSettings.weather).toEqual({
      enabled: true,
      units: "fahrenheit",
      displaySeconds: 15,
      title: "Weather",
    });
  });
  it("accepts Drive overrides and rejects bad values per key", () => {
    const { settings, problems } = mergeSettings(defaultSettings, {
      weather: {
        units: "celsius",
        displaySeconds: 20,
        enabled: "yes",
        title: "",
      },
    });
    expect(settings.weather).toEqual({
      enabled: true,
      units: "celsius",
      displaySeconds: 20,
      title: "Weather",
    });
    expect(problems).toHaveLength(2);
    expect(
      mergeSettings(defaultSettings, { weather: { enabled: false } }).settings
        .weather.enabled,
    ).toBe(false);
  });
});

describe("getWeatherLocation", () => {
  const warn = () => vi.spyOn(console, "warn").mockImplementation(() => {});
  it("is null (weather off) when nothing is set", () => {
    expect(getWeatherLocation({})).toBeNull();
  });
  it("uses coordinates when both are valid, ahead of a ZIP", () => {
    expect(
      getWeatherLocation({
        WEATHER_LATITUDE: "40.5",
        WEATHER_LONGITUDE: " -75.25 ",
        WEATHER_ZIP: "00000",
      }),
    ).toEqual({ kind: "coords", latitude: 40.5, longitude: -75.25 });
  });
  it("falls back to the ZIP when coordinates are missing or invalid", () => {
    warn();
    expect(
      getWeatherLocation({ WEATHER_LATITUDE: "40.5", WEATHER_ZIP: "00000" }),
    ).toEqual({
      kind: "zip",
      zip: "00000",
      country: "US",
    });
    expect(
      getWeatherLocation({
        WEATHER_LATITUDE: "95",
        WEATHER_LONGITUDE: "10",
        WEATHER_ZIP: "AB1 2CD",
        WEATHER_COUNTRY: "gb",
      }),
    ).toEqual({ kind: "zip", zip: "AB1 2CD", country: "GB" });
  });
  it("is null for only-invalid input, and an invalid country becomes US", () => {
    warn();
    expect(
      getWeatherLocation({ WEATHER_LATITUDE: "abc", WEATHER_LONGITUDE: "1" }),
    ).toBeNull();
    expect(getWeatherLocation({ WEATHER_ZIP: "<script>" })).toBeNull();
    expect(
      getWeatherLocation({ WEATHER_ZIP: "00000", WEATHER_COUNTRY: "USA" }),
    ).toEqual({
      kind: "zip",
      zip: "00000",
      country: "US",
    });
  });
});

describe("settings from a malformed config.json never throw", () => {
  const cases: [string, string][] = [
    ["empty file", ""],
    ["not JSON", "imageSeconds = 30"],
    ["trailing comma", '{"calendar": {"title": "Hi",}}'],
    ["a number", "42"],
    ["null", "null"],
    ["an array", "[1, 2, 3]"],
    ["a string", '"hello"'],
    ["section is a string", '{"slideshow": "fast"}'],
    ["section is an array", '{"calendar": [1]}'],
    [
      "wrong value types",
      '{"slideshow": {"imageSeconds": "30", "imageFit": 5}, "calendar": {"eventsPerPage": -1, "title": ""}}',
    ],
    [
      "prototype-ish keys",
      '{"__proto__": {"x": 1}, "constructor": 1, "slideshow": {"__proto__": 1, "toString": 2, "constructor": 3, "hasOwnProperty": 4}}',
    ],
    ["bad timezone", '{"timezone": "Mars/Olympus"}'],
    ["timezone not a string", '{"timezone": 5}'],
    ["env-only setting", '{"refresh": {"sourceMinutes": 1}}'],
    ["byte order mark", '﻿{"slideshow": {"imageSeconds": 25}}'],
  ];
  for (const [label, text] of cases) {
    it(label, () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const s = buildSettings("UTC", parseOverrideText(text));
      expect(s.timezone).toBe("UTC");
      expect(s.refresh.sourceMinutes).toBe(
        defaultSettings.refresh.sourceMinutes,
      );
      expect(Object.getPrototypeOf(s)).toBe(Object.prototype);
      expect(({} as Record<string, unknown>).x).toBeUndefined();
      warn.mockRestore();
    });
  }

  it("mergeSettings itself treats inherited names like toString as unknown settings", () => {
    const r = mergeSettings(
      defaultSettings,
      JSON.parse('{"slideshow": {"toString": 1, "__proto__": 2}}'),
    );
    expect(r.settings).toEqual(defaultSettings);
    expect(r.problems).toHaveLength(2);
  });

  it("keeps good values next to bad ones", () => {
    const r = mergeSettings(defaultSettings, {
      slideshow: { imageSeconds: 30, imageFit: "sideways" },
    });
    expect(r.settings.slideshow.imageSeconds).toBe(30);
    expect(r.settings.slideshow.imageFit).toBe(
      defaultSettings.slideshow.imageFit,
    );
    expect(r.problems).toHaveLength(1);
  });
});

describe("checkConfigFile (Drive settings problems shown in /slideshow)", () => {
  const template = async () => {
    const { readFileSync } = await import("node:fs");
    return readFileSync(new URL("../../docs/config.txt", import.meta.url), "utf8");
  };
  const doc = (text: string | null, ignored: string[] = []): ConfigSource => ({
    kind: "doc",
    name: 'the Google Doc "config"',
    text,
    ignored,
  });
  const json = (text: string): ConfigSource => ({ kind: "json", name: "config.json", text, ignored: [] });

  it("has nothing to say without a file, or for the template Doc", async () => {
    expect(checkConfigFile(null)).toBeNull();
    expect(checkConfigFile(doc(await template()))).toBeNull();
  });
  it("a fine config.json still gets a note suggesting the Doc", () => {
    const full = JSON.stringify({ ...defaultSettings, refresh: { playlistMinutes: 10, pageReloadHours: 6 } });
    const r = checkConfigFile(json(full))!;
    expect(r.problems).toEqual([]);
    expect(r.missing).toEqual([]);
    expect(r.note).toMatch(/Google Doc named "config"/);
  });
  it("broken JSON or an unreadable file: everything ignored, fixed copy is the defaults", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const r of [checkConfigFile(json('{"slideshow": {')), checkConfigFile(doc(null)), checkConfigFile(doc("<html>Sign in</html>"))]) {
      expect(r!.problems).toHaveLength(1);
      expect(r!.fixed).toBe(await template());
    }
  });
  it("config.json: keeps valid values, names problems by their JSON path, lists missing ones", () => {
    const r = checkConfigFile(
      json(JSON.stringify({ timezone: "America/Chicago", slideshow: { imageSeconds: 15, imageFit: "zoom", extra: 1 }, refresh: { sourceMinutes: 5 } })),
    )!;
    expect(r.problems).toEqual([
      'invalid value for "slideshow.imageFit"; using default',
      'unknown setting "slideshow.extra"; ignored',
      '"refresh.sourceMinutes" cannot be set from Drive; ignored',
    ]);
    expect(r.missing).toContain("holidays.daysBefore");
    expect(r.missing).not.toContain("refresh.sourceMinutes");
    expect(r.fixed).toContain("PICTURE_SECONDS = 15\n");
    expect(r.fixed).toContain("PICTURE_FIT = cover\n");
    expect(r.fixed).toContain("TIMEZONE = America/Chicago\n");
  });
  it("the Doc: names problems by their Doc names; the fixed copy reads back clean", () => {
    const r = checkConfigFile(doc("PICTURE_SECONDS = 9999\nTIMEZONE = Mars/Base", ['config.json']))!;
    expect(r.problems).toEqual([
      'config.json is ignored, because the Google Doc "config" is used; delete one of them',
      "invalid value for PICTURE_SECONDS; using default",
      "invalid value for TIMEZONE; using default",
    ]);
    expect(r.missing).toContain("HOLIDAY_DAYS_BEFORE");
    expect(r.fixed).not.toMatch(/^TIMEZONE/m);
    expect(checkConfigFile(doc(r.fixed))).toBeNull();
  });
  it("overrideFrom reads JSON or the Doc format", () => {
    expect(overrideFrom(null)).toBeNull();
    expect(overrideFrom(doc("picture seconds: 12"))).toEqual({ slideshow: { imageSeconds: 12 } });
    expect(overrideFrom(json('{"slideshow":{"imageSeconds":12}}'))).toEqual({ slideshow: { imageSeconds: 12 } });
  });
});
