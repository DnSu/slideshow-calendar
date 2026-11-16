import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { cleanDescription, parseIcs } from "@/lib/calendar";
import { isImageEntry, parseFolderListing } from "@/lib/drive";
import { assembleImages } from "@/lib/playlist";

const fixture = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8");

describe("parseFolderListing", () => {
  it("parses files and folders from a sample page", () => {
    const l = parseFolderListing(fixture("drive-folder.html"));
    expect(l.recognized).toBe(true);
    expect(l.entries.map((e) => [e.id, e.name, e.isFolder, isImageEntry(e)])).toEqual([
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
      { id: "fakeLiveImageId000000000001", name: "sample-photo.jpg", mime: "image/jpeg", isFolder: false },
    ]);
  });
  it("flags unrecognised pages without throwing", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseFolderListing("<html>Sign in</html>")).toEqual({ entries: [], recognized: false });
    expect(parseFolderListing("")).toEqual({ entries: [], recognized: false });
  });
});

describe("assembleImages", () => {
  it("orders root first then folders by name, skipping ended windows and non-images", () => {
    const e = (id: string, name: string, mime = "image/jpeg") => ({ id, name, mime, isFolder: false });
    const out = assembleImages(
      {
        root: [e("r2", "b.jpg"), e("r1", "a.jpg"), e("doc", "x.pdf", "application/pdf")],
        folders: [
          { name: "2026-12", window: { start: null, end: "2026-12-31" }, entries: [e("m1", "1.jpg")] },
          { name: "2026-01", window: { start: null, end: "2026-01-31" }, entries: [e("gone", "g.jpg")] },
          { name: "2026-03-01 2026-03-02", window: { start: "2026-03-01", end: "2026-03-02" }, entries: [e("w1", "w.jpg")] },
        ],
      },
      "2026-02-10",
    );
    expect(out.map((i) => i.id)).toEqual(["r1", "r2", "w1", "m1"]);
    expect(out[2]).toMatchObject({ start: "2026-03-01", end: "2026-03-02" });
  });
});

describe("parseIcs", () => {
  const range = { from: Date.parse("2026-03-09T00:00:00Z"), to: Date.parse("2026-04-08T00:00:00Z") };
  const ics = fixture("calendar.ics");

  it("returns events in range, expands repeats, and skips cancelled/past", () => {
    const events = parseIcs(ics, range, "UTC");
    expect(events.map((e) => `${e.title}@${new Date(e.start).toISOString()}`)).toEqual([
      "Weekly standup@2026-03-09T14:00:00.000Z",
      "Team meeting@2026-03-10T15:00:00.000Z",
      "Open house@2026-03-12T00:00:00.000Z",
      "Weekly standup@2026-03-16T14:00:00.000Z",
      "Weekly standup@2026-03-23T14:00:00.000Z",
      "Weekly standup@2026-03-30T14:00:00.000Z",
      "Weekly standup@2026-04-06T14:00:00.000Z",
    ]);
  });

  it("expands the weekly event", () => {
    const standups = parseIcs(ics, range, "UTC").filter((e) => e.title === "Weekly standup");
    expect(standups.map((e) => e.startDay)).toEqual([
      "2026-03-09", "2026-03-16", "2026-03-23", "2026-03-30", "2026-04-06",
    ]);
    expect(parseIcs(ics, range, "UTC").some((e) => e.title === "Cancelled thing" || e.title === "Long past")).toBe(false);
  });

  it("handles all-day events (end exclusive) in the configured timezone", () => {
    const open = parseIcs(ics, range, "America/New_York").find((e) => e.title === "Open house")!;
    expect(open.allDay).toBe(true);
    expect(open.startDay).toBe("2026-03-12");
    expect(open.endDay).toBe("2026-03-13");
    expect(open.start).toBe(Date.parse("2026-03-12T04:00:00Z"));
    expect(open.end).toBe(Date.parse("2026-03-14T04:00:00Z"));
  });

  it("cleans descriptions and carries location", () => {
    const meeting = parseIcs(ics, range, "UTC").find((e) => e.title === "Team meeting")!;
    expect(meeting.location).toBe("Room 1");
    expect(meeting.description).toBe("Bring notes & laptop\nSecond line");
  });

  it("parses an empty calendar to zero events", () => {
    expect(parseIcs(fixture("calendar-empty.ics"), range, "UTC")).toEqual([]);
    expect(parseIcs("BEGIN:VCALENDAR\nEND:VCALENDAR", range, "UTC")).toEqual([]);
  });
});

describe("cleanDescription", () => {
  it("strips HTML, decodes entities and shortens", () => {
    expect(cleanDescription("<a href='x'>Link</a>&nbsp;&lt;ok&gt; &#169;")).toBe("Link <ok> ©");
    const long = cleanDescription("word ".repeat(100), 50);
    expect(long.length).toBeLessThanOrEqual(51);
    expect(long.endsWith("…")).toBe(true);
  });
});
