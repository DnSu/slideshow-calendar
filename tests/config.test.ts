import { describe, expect, it, vi } from "vitest";
import { buildSettings, defaultSettings, getEnv, mergeSettings, parseOverrideText } from "@/lib/config";

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
