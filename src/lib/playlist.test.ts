import { describe, expect, it, vi } from "vitest";
import { isImageEntry, type DriveEntry, fileVersion } from "@/lib/drive";
import {
  assembleImages,
  readOverride,
  isEmergencyFolder,
} from "@/lib/playlist";

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
