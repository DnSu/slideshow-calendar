import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeEntities,
  downloadUrl,
  folderListingUrl,
  thumbnailUrl,
  downloadText,
  listFolder,
  fileVersion,
  isImageEntry,
  parseFolderListing,
} from "@/lib/drive";
import { readFileSync } from "node:fs";

/** These call the real functions with `fetch` replaced, so nothing leaves the machine. */
const fixture = (n: string) =>
  readFileSync(new URL(`./__fixtures__/${n}`, import.meta.url), "utf8");

const respond = (body: string | object, status = 200) =>
  vi.fn(
    async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
      }),
  );

afterEach(() => vi.unstubAllGlobals());

describe("drive URLs and entities", () => {
  it("builds encoded URLs", () => {
    expect(folderListingUrl("abc_123")).toBe(
      "https://drive.google.com/embeddedfolderview?id=abc_123",
    );
    expect(downloadUrl("a b")).toBe(
      "https://drive.google.com/uc?export=download&id=a%20b",
    );
    expect(thumbnailUrl("abc")).toBe(
      "https://drive.google.com/thumbnail?id=abc&sz=w1920",
    );
    expect(thumbnailUrl("abc", 800)).toContain("sz=w800");
  });
  it("decodes named and numeric entities, leaving unknown ones alone", () => {
    expect(decodeEntities("Tom &amp; Jerry&#39;s &#x263A; &lt;b&gt;")).toBe(
      "Tom & Jerry's ☺ <b>",
    );
    expect(decodeEntities("&bogus; &#0;")).toBe("&bogus; &#0;");
  });
});

describe("drive requests", () => {
  it("lists a folder page", async () => {
    vi.stubGlobal("fetch", respond(fixture("drive-folder.html")));
    const l = await listFolder("fakeFolder");
    expect(l.recognized).toBe(true);
    expect(l.entries.length).toBe(5);
  });
  it("throws on HTTP errors", async () => {
    vi.stubGlobal("fetch", respond("", 500));
    await expect(listFolder("fakeFolder")).rejects.toThrow("HTTP 500");
  });
  it("downloads small text files and refuses large ones", async () => {
    vi.stubGlobal("fetch", respond('{"a":1}'));
    await expect(downloadText("fakeFile")).resolves.toBe('{"a":1}');
    vi.stubGlobal("fetch", respond("x".repeat(64 * 1024 + 1)));
    await expect(downloadText("fakeFile")).rejects.toThrow("larger than");
  });
});

describe("parseFolderListing", () => {
  it("parses files and folders from a sample page", () => {
    const l = parseFolderListing(fixture("drive-folder.html"));
    expect(l.recognized).toBe(true);
    expect(
      l.entries.map((e) => [e.id, e.name, e.isFolder, isImageEntry(e)]),
    ).toEqual([
      ["fakeImageId0000000000000000001", "Welcome & Hello.jpg", false, true],
      ["fakeImageId0000000000000000002", "a-second.png", false, true],
      ["fakeDocId00000000000000000003", "notes.pdf", false, false],
      ["fakeConfigId000000000000000004", "config.json", false, false],
      ["fakeFolderId00000000000000005", "2026-12-01 2026-12-31", true, false],
    ]);
  });
  it("parses a real, empty folder page to zero entries", () => {
    const l = parseFolderListing(fixture("drive-empty-folder.html"));
    expect(l).toEqual({ entries: [], recognized: true });
  });
  it("parses a page captured from a real folder with one image (IDs scrubbed)", () => {
    const l = parseFolderListing(fixture("drive-one-image-live.html"));
    expect(l.entries).toEqual([
      {
        id: "fakeLiveImageId000000000001",
        name: "sample-photo.jpg",
        mime: "image/jpeg",
        isFolder: false,
        modified: "12:10\u202fpm", // Drive puts a narrow no-break space before am/pm
      },
    ]);
  });
  it("reads each entry's last-modified text", () => {
    const l = parseFolderListing(fixture("drive-folder.html"));
    expect(l.entries[0].modified).toBe("Jan 5, 2026");
  });
  it("flags unrecognised pages without throwing", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseFolderListing("<html>Sign in</html>")).toEqual({
      entries: [],
      recognized: false,
    });
    expect(parseFolderListing("")).toEqual({ entries: [], recognized: false });
  });
});

describe("fileVersion", () => {
  it("is short, URL-safe, stable, and changes with the modified text", () => {
    expect(fileVersion("7:29 pm")).toBe(fileVersion("7:29 pm"));
    expect(fileVersion("7:29 pm")).not.toBe(fileVersion("7:31 pm"));
    expect(fileVersion("Nov 10")).not.toBe(fileVersion("Nov 11"));
    expect(fileVersion("Jan 5, 2026")).toMatch(/^[a-z0-9]{1,7}$/);
  });
});
