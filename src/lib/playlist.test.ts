import { describe, expect, it, vi } from "vitest";
import { isImageEntry, type DriveEntry, fileVersion } from "@/lib/drive";
import {
  assembleImages,
  readOverride,
  isEmergencyFolder,
  isHolidaysFolder,
} from "@/lib/playlist";
import { isActiveOnDay } from "@/lib/folderDates";

const file = (id: string, name: string, mime: string | null): DriveEntry => ({
  id,
  name,
  mime,
  isFolder: false,
});

// The two files from docs/ as they would appear in the Drive folder root.
const guide = file(
  "fakeGuideId000000000001",
  "HOW-TO-USE-THIS-FOLDER.txt",
  "text/plain",
);

const config = file(
  "fakeConfigId00000000001",
  "config.json",
  "application/json",
);

const photo = file("fakePhotoId000000000001", "01-welcome.jpg", "image/jpeg");

describe("non-image files in the Drive folder", () => {
  it("never become slides, with or without a known mime type", () => {
    for (const e of [
      guide,
      config,
      { ...guide, mime: null },
      { ...config, mime: null },
      file("x", "Guide", "application/vnd.google-apps.document"),
    ]) {
      expect(isImageEntry(e), e.name).toBe(false);
    }
    const images = assembleImages(
      { root: [guide, config, photo], folders: [] },
      "2026-11-16",
    );
    expect(images.map((i) => i.id)).toEqual([photo.id]);
  });

  it("are ignored inside date folders too", () => {
    const images = assembleImages(
      {
        root: [],
        folders: [
          {
            name: "0000-11",
            window: {
              start: null,
              end: null,
              yearly: { from: "11-01", to: "11-30" },
            },
            entries: [guide, config, photo],
          },
        ],
      },
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
    expect(
      await readOverride(
        [
          file("a", "config (1).json", null),
          file("b", "config.json.txt", null),
        ],
        download,
      ),
    ).toBeNull();
    expect(download).not.toHaveBeenCalled();
  });

  it("parses a valid file", async () => {
    expect(
      await readOverride(
        [guide, config],
        async () => '{"slideshow":{"imageSeconds":30}}',
      ),
    ).toEqual({
      slideshow: { imageSeconds: 30 },
    });
  });

  it("ignores malformed JSON, a failed download, and an HTML error page", async () => {
    const warn = silence();
    expect(
      await readOverride(
        [config],
        async () => '{"slideshow": {"imageSeconds": 30,}',
      ),
    ).toBeNull();
    expect(
      await readOverride([config], async () => {
        throw new Error("HTTP 500");
      }),
    ).toBeNull();
    expect(
      await readOverride(
        [config],
        async () => "<!DOCTYPE html><html>Sign in</html>",
      ),
    ).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("Emergency Override", () => {
  const img = (id: string, name: string) => ({
    id,
    name,
    mime: "image/png",
    isFolder: false,
  });
  const base = {
    root: [img("r1", "always.png")],
    folders: [
      {
        name: "2026-12",
        window: { start: null, end: "2026-12-31" },
        entries: [img("d1", "dec.png")],
      },
    ],
  };
  it("recognises the folder name loosely", () => {
    expect(isEmergencyFolder("Emergency Override")).toBe(true);
    expect(isEmergencyFolder("  emergency   override ")).toBe(true);
    expect(isEmergencyFolder("Emergency")).toBe(false);
  });
  it("shows only its images, by name, while it has any", () => {
    const out = assembleImages(
      {
        ...base,
        emergency: [
          img("e2", "b.png"),
          img("e1", "a.png"),
          { ...img("t", "note.txt"), mime: "text/plain" },
        ],
      },
      "2026-11-16",
    );
    expect(out.map((i) => i.id)).toEqual(["e1", "e2"]);
    expect(
      out.every((i) => i.start === null && i.end === null && !i.yearly),
    ).toBe(true);
  });
  it("is ignored when empty or holding no images", () => {
    expect(
      assembleImages({ ...base, emergency: [] }, "2026-11-16").map((i) => i.id),
    ).toEqual(["r1", "d1"]);
    expect(
      assembleImages(
        {
          ...base,
          emergency: [{ ...img("t", "note.txt"), mime: "text/plain" }],
        },
        "2026-11-16",
      ).map((i) => i.id),
    ).toEqual(["r1", "d1"]);
  });
});

describe("assembleImages", () => {
  it("gives images a version from their modified text, so a replaced file gets a new URL", () => {
    const out = assembleImages(
      {
        root: [
          {
            id: "a",
            name: "a.jpg",
            mime: "image/jpeg",
            isFolder: false,
            modified: "7:29 pm",
          },
          { id: "b", name: "b.jpg", mime: "image/jpeg", isFolder: false },
        ],
        folders: [],
      },
      "2026-11-16",
    );
    expect(out[0].version).toBe(fileVersion("7:29 pm"));
    expect(out[1]).not.toHaveProperty("version");
  });
  it("orders root first then folders by name, skipping ended windows and non-images", () => {
    const e = (id: string, name: string, mime = "image/jpeg") => ({
      id,
      name,
      mime,
      isFolder: false,
    });
    const out = assembleImages(
      {
        root: [
          e("r2", "b.jpg"),
          e("r1", "a.jpg"),
          e("doc", "x.pdf", "application/pdf"),
        ],
        folders: [
          {
            name: "2026-12",
            window: { start: null, end: "2026-12-31" },
            entries: [e("m1", "1.jpg")],
          },
          {
            name: "2026-01",
            window: { start: null, end: "2026-01-31" },
            entries: [e("gone", "g.jpg")],
          },
          {
            name: "2026-03-01 2026-03-02",
            window: { start: "2026-03-01", end: "2026-03-02" },
            entries: [e("w1", "w.jpg")],
          },
        ],
      },
      "2026-02-10",
    );
    expect(out.map((i) => i.id)).toEqual(["r1", "r2", "w1", "m1"]);
    expect(out[2]).toMatchObject({ start: "2026-03-01", end: "2026-03-02" });
  });
});

describe("Holidays folder", () => {
  const img = (id: string, name = `${id}.png`) => ({ id, name, mime: "image/png", isFolder: false });
  const snapshot = {
    root: [img("r1")],
    folders: [],
    holidays: [
      { name: "January 1 - New Year's Day", rule: { kind: "date" as const, month: 1, day: 1 }, entries: [img("nyd")] },
      { name: "December 31 - New Year's Eve", rule: { kind: "date" as const, month: 12, day: 31 }, entries: [img("nye")] },
      {
        name: "Fourth Thursday in November - Thanksgiving",
        rule: { kind: "weekday" as const, month: 11, weekday: 4, nth: 4 },
        entries: [img("tg")],
      },
      {
        name: "0000-12-01 0000-12-31 - Happy Holidays",
        window: { start: null, end: null, yearly: { from: "12-01", to: "12-31" } },
        entries: [img("hh")],
      },
      { name: "2026-01-01 - Old", window: { start: null, end: "2026-01-01" }, entries: [img("old")] },
    ],
  };
  it("recognises the folder name loosely", () => {
    expect(isHolidaysFolder(" holidays ")).toBe(true);
    expect(isHolidaysFolder("Holiday")).toBe(false);
  });
  it("puts holidays first, soonest first, then date-named ones, then the root", () => {
    const out = assembleImages(snapshot, "2026-11-17");
    expect(out.map((i) => i.id)).toEqual(["tg", "nye", "nyd", "hh", "r1"]);
    expect(out[0].holiday).toEqual({ rule: snapshot.holidays[2].rule, before: 7, after: 1 });
  });
  it("only the current holidays are active", () => {
    const out = assembleImages(snapshot, "2026-12-28");
    const active = (day: string) => out.filter((i) => isActiveOnDay(i, day)).map((i) => i.id);
    expect(active("2026-11-17")).toEqual(["r1"]);
    expect(active("2026-11-20")).toEqual(["tg", "r1"]);
    expect(active("2026-12-28")).toEqual(["nye", "nyd", "hh", "r1"]);
  });
  it("uses the configured day counts", () => {
    const out = assembleImages(snapshot, "2026-11-17", { daysBefore: 2, daysAfter: 0 });
    const tg = out.find((i) => i.id === "tg")!;
    expect(isActiveOnDay(tg, "2026-11-23")).toBe(false);
    expect(isActiveOnDay(tg, "2026-11-24")).toBe(true);
    expect(isActiveOnDay(tg, "2026-11-27")).toBe(false);
  });
  it("Emergency Override still wins", () => {
    const out = assembleImages({ ...snapshot, emergency: [img("e1")] }, "2026-11-25");
    expect(out.map((i) => i.id)).toEqual(["e1"]);
  });
});
