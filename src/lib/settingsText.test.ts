import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultSettings, mergeSettings } from "@/lib/config";
import { parseSettingsText, SETTING_GROUPS, settingsText } from "@/lib/settingsText";

describe("settings Doc format", () => {
  it("covers every setting Drive can change, once", () => {
    const paths = SETTING_GROUPS.flatMap((g) => g.fields.map((f) => f.path)).sort();
    const expected = Object.entries(defaultSettings)
      .flatMap(([section, values]) => Object.keys(values).map((k) => `${section}.${k}`))
      .filter((p) => p !== "refresh.sourceMinutes")
      .sort();
    expect(paths).toEqual(expected);
  });

  it("docs/config.txt (the template to paste into the Doc) is the defaults", () => {
    const template = readFileSync(new URL("../../docs/config.txt", import.meta.url), "utf8");
    expect(settingsText(defaultSettings)).toBe(template);
    const { override, problems } = parseSettingsText(template);
    expect(problems).toEqual([]);
    const merged = mergeSettings(defaultSettings, override);
    expect(merged.problems).toEqual([]);
    expect(merged.settings).toEqual(defaultSettings);
  });

  it("is forgiving about what Google Docs and people do to the text", () => {
    const text = [
      "﻿# notes are ignored",
      "picture seconds = 12 seconds",
      "Picture_Fit: “Contain”",
      "FADE_SECONDS=0.5",
      "show weather = No",
      "CALENDAR_TITLE = ‘This Week’",
      "CALENDAR_DAYS_AHEAD = 1,000",
      "  // also a note",
      "",
    ].join("\r\n");
    const { override, problems } = parseSettingsText(text);
    expect(problems).toEqual([]);
    expect(override).toEqual({
      slideshow: { imageSeconds: 12, imageFit: "contain", transitionMs: 500 },
      weather: { enabled: false },
      calendar: { title: "This Week", fetchDays: 1000 },
    });
  });

  it("explains each mistake and keeps the other lines", () => {
    const { override, problems } = parseSettingsText(
      [
        "PICTURE_SECONDS = twenty",
        "PICTURE_FIT = zoom",
        "SHOW_WEATHER = maybe",
        "PICTUR_SECONDS = 5",
        "just some words",
        "WEATHER_TITLE =",
        "EVENTS_PER_PAGE = 6",
        "EVENTS_PER_PAGE = 7",
      ].join("\n"),
    );
    expect(problems).toEqual([
      'PICTURE_SECONDS should be a number, not "twenty"; using the default',
      'PICTURE_FIT should be cover or contain, not "zoom"; using the default',
      'SHOW_WEATHER should be yes or no, not "maybe"; using the default',
      "line 4: there's no setting called PICTUR_SECONDS; it's ignored",
      `line 5 ("just some words") isn't in the form NAME = value; it's ignored`,
      "WEATHER_TITLE has no value; using the default",
      "EVENTS_PER_PAGE is set more than once; the last one is used",
    ]);
    expect(override).toEqual({ calendar: { eventsPerPage: 7 } });
  });

  it("round-trips settings, including yes/no, seconds→ms and a timezone", () => {
    const settings = structuredClone(defaultSettings);
    settings.slideshow.transitionMs = 750;
    settings.offline.showIndicator = false;
    const text = settingsText(settings, "America/Chicago");
    expect(text).toContain("FADE_SECONDS = 0.75\n");
    expect(text).toContain("SHOW_OFFLINE_DOT = no\n");
    const { override, problems } = parseSettingsText(text);
    expect(problems).toEqual([]);
    expect((override as { timezone: string }).timezone).toBe("America/Chicago");
    expect(mergeSettings(defaultSettings, override).settings).toEqual(settings);
  });
});
