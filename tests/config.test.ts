import { describe, expect, it, vi } from "vitest";
import { buildSettings, defaultSettings, getEnv, getWeatherLocation, mergeSettings, parseOverrideText } from "@/lib/config";

describe("getEnv", () => {
  it("requires the IDs", () => {
    expect(() => getEnv({})).toThrow(/DRIVE_FOLDER_ID, CALENDAR_ID/);
    expect(() => getEnv({ DRIVE_FOLDER_ID: "x1", CALENDAR_ID: " " })).toThrow(/CALENDAR_ID/);
  });
  it("defaults and validates the timezone", () => {
    const base = { DRIVE_FOLDER_ID: "fake-folder", CALENDAR_ID: "fake@example.invalid" };
    expect(getEnv(base).timezone).toBe("UTC");
    expect(getEnv({ ...base, TIMEZONE: "Europe/Paris" }).timezone).toBe("Europe/Paris");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getEnv({ ...base, TIMEZONE: "Nowhere/Land" }).timezone).toBe("UTC");
  });
});

describe("mergeSettings", () => {
  it("returns defaults with no override", () => {
    expect(mergeSettings(defaultSettings, null).settings).toEqual(defaultSettings);
  });
  it("applies valid values and leaves the rest", () => {
    const { settings, problems } = mergeSettings(defaultSettings, {
      slideshow: { imageSeconds: 10, imageFit: "cover" },
      calendar: { title: "What's On" },
    });
    expect(problems).toEqual([]);
    expect(settings.slideshow).toEqual({ ...defaultSettings.slideshow, imageSeconds: 10, imageFit: "cover" });
    expect(settings.calendar.title).toBe("What's On");
    expect(settings.calendar.eventsPerPage).toBe(defaultSettings.calendar.eventsPerPage);
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
    expect(mergeSettings(defaultSettings, [1, 2]).settings).toEqual(defaultSettings);
  });
  it("ignores the removed daysAhead/maxEvents settings", () => {
    const r = mergeSettings(defaultSettings, { calendar: { daysAhead: 30, maxEvents: 4 } });
    expect(r.settings.calendar).toEqual(defaultSettings.calendar);
    expect(r.problems).toHaveLength(2);
  });
});

describe("buildSettings / parseOverrideText", () => {
  it("lets Drive override the timezone only if valid", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(buildSettings("UTC", { timezone: "Asia/Tokyo" }).timezone).toBe("Asia/Tokyo");
    expect(buildSettings("UTC", { timezone: "bad" }).timezone).toBe("UTC");
    expect(buildSettings("Europe/Paris", null).timezone).toBe("Europe/Paris");
  });
  it("treats invalid JSON as no override", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseOverrideText("{ nope")).toBeNull();
    expect(parseOverrideText('﻿{"a":1}')).toEqual({ a: 1 });
  });
});

describe("docs/config.json (the copy-to-Drive template)", () => {
  it("is valid, has no ignored settings, and matches the code defaults", async () => {
    const { readFileSync } = await import("node:fs");
    const template = JSON.parse(readFileSync(new URL("../docs/config.json", import.meta.url), "utf8"));
    const r = mergeSettings(defaultSettings, template);
    expect(r.problems).toEqual([]);
    expect(r.settings).toEqual(defaultSettings);
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
      weather: { units: "celsius", displaySeconds: 20, enabled: "yes", title: "" },
    });
    expect(settings.weather).toEqual({ enabled: true, units: "celsius", displaySeconds: 20, title: "Weather" });
    expect(problems).toHaveLength(2);
    expect(mergeSettings(defaultSettings, { weather: { enabled: false } }).settings.weather.enabled).toBe(false);
  });
});

describe("getWeatherLocation", () => {
  const warn = () => vi.spyOn(console, "warn").mockImplementation(() => {});
  it("is null (weather off) when nothing is set", () => {
    expect(getWeatherLocation({})).toBeNull();
  });
  it("uses coordinates when both are valid, ahead of a ZIP", () => {
    expect(
      getWeatherLocation({ WEATHER_LATITUDE: "40.5", WEATHER_LONGITUDE: " -75.25 ", WEATHER_ZIP: "00000" }),
    ).toEqual({ kind: "coords", latitude: 40.5, longitude: -75.25 });
  });
  it("falls back to the ZIP when coordinates are missing or invalid", () => {
    warn();
    expect(getWeatherLocation({ WEATHER_LATITUDE: "40.5", WEATHER_ZIP: "00000" })).toEqual({
      kind: "zip", zip: "00000", country: "US",
    });
    expect(
      getWeatherLocation({ WEATHER_LATITUDE: "95", WEATHER_LONGITUDE: "10", WEATHER_ZIP: "AB1 2CD", WEATHER_COUNTRY: "gb" }),
    ).toEqual({ kind: "zip", zip: "AB1 2CD", country: "GB" });
  });
  it("is null for only-invalid input, and an invalid country becomes US", () => {
    warn();
    expect(getWeatherLocation({ WEATHER_LATITUDE: "abc", WEATHER_LONGITUDE: "1" })).toBeNull();
    expect(getWeatherLocation({ WEATHER_ZIP: "<script>" })).toBeNull();
    expect(getWeatherLocation({ WEATHER_ZIP: "00000", WEATHER_COUNTRY: "USA" })).toEqual({
      kind: "zip", zip: "00000", country: "US",
    });
  });
});
