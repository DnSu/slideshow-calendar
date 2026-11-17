import { describe, expect, it, vi } from "vitest";
import { buildSettings, defaultSettings, mergeSettings, parseOverrideText } from "@/lib/config";
import { isImageEntry, type DriveEntry } from "@/lib/drive";
import { assembleImages, readOverride } from "@/lib/playlist";

const file = (id: string, name: string, mime: string | null): DriveEntry => ({ id, name, mime, isFolder: false });

// The two files from docs/ as they would appear in the Drive folder root.
const guide = file("fakeGuideId000000000001", "HOW-TO-USE-THIS-FOLDER.txt", "text/plain");
const config = file("fakeConfigId00000000001", "config.json", "application/json");
const photo = file("fakePhotoId000000000001", "01-welcome.jpg", "image/jpeg");

describe("non-image files in the Drive folder", () => {
  it("never become slides, with or without a known mime type", () => {
    for (const e of [guide, config, { ...guide, mime: null }, { ...config, mime: null },
      file("x", "Guide", "application/vnd.google-apps.document")]) {
      expect(isImageEntry(e), e.name).toBe(false);
    }
    const images = assembleImages({ root: [guide, config, photo], folders: [] }, "2026-11-16");
    expect(images.map((i) => i.id)).toEqual([photo.id]);
  });

  it("are ignored inside date folders too", () => {
    const images = assembleImages(
      { root: [], folders: [{ name: "0000-11", window: { start: null, end: null, yearly: { from: "11-01", to: "11-30" } }, entries: [guide, config, photo] }] },
      "2026-11-16",
    );
    expect(images.map((i) => i.id)).toEqual([photo.id]);
  });
});

describe("readOverride (Drive config.json)", () => {
  const silence = () => vi.spyOn(console, "warn").mockImplementation(() => {});

  it("returns null when there is no config.json, and ignores near-miss names", async () => {
    const download = vi.fn();
    expect(await readOverride([guide, photo], download)).toBeNull();
    expect(await readOverride([file("a", "config (1).json", null), file("b", "config.json.txt", null)], download)).toBeNull();
    expect(download).not.toHaveBeenCalled();
  });

  it("parses a valid file", async () => {
    expect(await readOverride([guide, config], async () => '{"slideshow":{"imageSeconds":30}}')).toEqual({
      slideshow: { imageSeconds: 30 },
    });
  });

  it("ignores malformed JSON, a failed download, and an HTML error page", async () => {
    const warn = silence();
    expect(await readOverride([config], async () => '{"slideshow": {"imageSeconds": 30,}')).toBeNull();
    expect(await readOverride([config], async () => { throw new Error("HTTP 500"); })).toBeNull();
    expect(await readOverride([config], async () => "<!DOCTYPE html><html>Sign in</html>")).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
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
    ["wrong value types", '{"slideshow": {"imageSeconds": "30", "imageFit": 5}, "calendar": {"eventsPerPage": -1, "title": ""}}'],
    ["prototype-ish keys", '{"__proto__": {"x": 1}, "constructor": 1, "slideshow": {"__proto__": 1, "toString": 2, "constructor": 3, "hasOwnProperty": 4}}'],
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
      expect(s.refresh.sourceMinutes).toBe(defaultSettings.refresh.sourceMinutes);
      expect(Object.getPrototypeOf(s)).toBe(Object.prototype);
      expect(({} as Record<string, unknown>).x).toBeUndefined();
      warn.mockRestore();
    });
  }

  it("mergeSettings itself treats inherited names like toString as unknown settings", () => {
    const r = mergeSettings(defaultSettings, JSON.parse('{"slideshow": {"toString": 1, "__proto__": 2}}'));
    expect(r.settings).toEqual(defaultSettings);
    expect(r.problems).toHaveLength(2);
  });

  it("keeps good values next to bad ones", () => {
    const r = mergeSettings(defaultSettings, { slideshow: { imageSeconds: 30, imageFit: "sideways" } });
    expect(r.settings.slideshow.imageSeconds).toBe(30);
    expect(r.settings.slideshow.imageFit).toBe(defaultSettings.slideshow.imageFit);
    expect(r.problems).toHaveLength(1);
  });
});
