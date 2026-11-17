import { describe, expect, it } from "vitest";
import { eventPages } from "@/lib/events";
import { mergePlaylist } from "@/lib/merge";
import { activeImages, initialSeqState, nextSlide, previewCycle, trustedNow, type Slide, sequence } from "@/lib/slides";
import { defaultSettings } from "@/lib/config";
import type { Playlist, PlaylistEvent } from "@/lib/types";

function run(ids: string[], hasEvents: boolean, steps: number, after = 5, hasWeather = false) {
  let state = initialSeqState;
  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    const r = nextSlide(state, ids, hasEvents, after, hasWeather);
    state = r.state;
    out.push(label(r.slide));
  }
  return out;
}
const label = (s: Slide | null) => (s === null ? "-" : s.kind === "calendar" ? "CAL" : s.kind === "weather" ? "WX" : s.id);

describe("nextSlide", () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g"];
  it("shows the calendar after every 5 images", () => {
    expect(run(ids, true, 14)).toEqual([
      "a", "b", "c", "d", "e", "CAL", "f", "g", "a", "b", "c", "CAL", "d", "e",
    ]);
  });
  it("skips the calendar without events", () => {
    expect(run(["a", "b"], false, 7)).toEqual(["a", "b", "a", "b", "a", "b", "a"]);
  });
  it("keeps the calendar when there are no images", () => {
    expect(run([], true, 3)).toEqual(["CAL", "CAL", "CAL"]);
  });
  it("shows nothing with neither", () => {
    expect(run([], false, 2)).toEqual(["-", "-"]);
  });
  it("copes with a shrinking list", () => {
    const first = nextSlide({ cursor: 6, shown: 1 }, ["a", "b"], false, 5);
    expect(label(first.slide)).toBe("a");
  });
});

describe("nextSlide with weather", () => {
  const ids = ["a", "b", "c"];
  it("plays images, then calendar, then weather", () => {
    expect(run(ids, true, 9, 2, true)).toEqual(["a", "b", "CAL", "WX", "c", "a", "CAL", "WX", "b"]);
  });
  it("shows weather alone when the calendar has no events", () => {
    expect(run(ids, false, 7, 2, true)).toEqual(["a", "b", "WX", "c", "a", "WX", "b"]);
  });
  it("skips weather when there is no forecast (same as before)", () => {
    expect(run(ids, true, 7, 2, false)).toEqual(["a", "b", "CAL", "c", "a", "CAL", "b"]);
  });
  it("skips both when empty", () => {
    expect(run(ids, false, 4, 2, false)).toEqual(["a", "b", "c", "a"]);
  });
  it("with no images repeats the info turn, or shows nothing", () => {
    expect(run([], true, 5, 2, true)).toEqual(["CAL", "WX", "CAL", "WX", "CAL"]);
    expect(run([], false, 2, 2, true)).toEqual(["WX", "WX"]);
    expect(run([], false, 2, 2, false)).toEqual(["-", "-"]);
  });
  it("drops a pending weather step if the forecast vanishes", () => {
    const first = nextSlide({ cursor: 0, shown: 0, weatherDue: true }, ids, true, 5, false);
    expect(label(first.slide)).toBe("a");
  });
});

describe("activeImages", () => {
  const imgs = [
    { id: "root", name: "r", start: null, end: null },
    { id: "old", name: "o", start: null, end: "2026-12-30" },
    { id: "range", name: "x", start: "2026-12-31", end: "2027-01-02" },
  ];
  it("applies windows by day in the timezone", () => {
    const at = Date.parse("2026-12-31T12:00:00Z");
    expect(activeImages(imgs, at, "UTC").map((i) => i.id)).toEqual(["root", "range"]);
    expect(activeImages(imgs, Date.parse("2027-01-03T12:00:00Z"), "UTC").map((i) => i.id)).toEqual(["root"]);
  });
});

describe("trustedNow", () => {
  it("never goes earlier than the last server time", () => {
    expect(trustedNow(1000, 5000)).toBe(5000);
    expect(trustedNow(9000, 5000)).toBe(9000);
  });
});

const ev = (id: string, start: string, end: string, extra: Partial<PlaylistEvent> = {}): PlaylistEvent => ({
  id, title: id, location: "", description: "", allDay: false,
  start: Date.parse(start), end: Date.parse(end),
  startDay: start.slice(0, 10), endDay: end.slice(0, 10), ...extra,
});

describe("eventPages", () => {
  const now = Date.parse("2026-03-10T12:00:00Z");
  const opts = { eventsPerPage: 3 };
  const days = (pages: ReturnType<typeof eventPages>) =>
    pages.map((p) => p.map((g) => [g.day, g.events.map((e) => e.id)]));
  it("keeps all future events (no horizon), drops past ones, groups by day", () => {
    const events = [
      ev("past", "2026-03-10T09:00:00Z", "2026-03-10T10:00:00Z"),
      ev("far", "2027-02-01T15:00:00Z", "2027-02-01T16:00:00Z"),
      ev("later", "2026-03-10T15:00:00Z", "2026-03-10T16:00:00Z"),
      ev("now", "2026-03-10T11:00:00Z", "2026-03-10T13:00:00Z"),
    ];
    expect(days(eventPages(events, now, "UTC", opts))).toEqual([
      [["2026-03-10", ["now", "later"]], ["2027-02-01", ["far"]]],
    ]);
  });
  it("splits into pages and repeats a day heading that spans pages", () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      ev(`e${i}`, `2026-03-1${Math.floor(i / 2) + 1}T1${i}:00:00Z`, `2026-03-1${Math.floor(i / 2) + 1}T1${i}:30:00Z`),
    );
    const pages = eventPages(many, now, "UTC", opts);
    expect(pages.map((p) => p.flatMap((g) => g.events).length)).toEqual([3, 3, 1]);
    expect(days(pages)[1][0]).toEqual(["2026-03-12", ["e3"]]);
    expect(eventPages([], now, "UTC", opts)).toEqual([]);
  });
  it("files a running multi-day event under today", () => {
    const e = ev("multi", "2026-03-08T00:00:00Z", "2026-03-12T00:00:00Z", { allDay: true });
    expect(eventPages([e], now, "UTC", opts)[0][0].day).toBe("2026-03-10");
  });
});

describe("mergePlaylist", () => {
  const base = (over: Partial<Playlist>): Playlist => ({
    images: [], events: [], config: { ...defaultSettings, timezone: "UTC" }, serverTime: 1000, degraded: [], release: "dev", ...over,
  });
  const img = (id: string) => ({ id, name: id, start: null, end: null });
  it("keeps data for degraded sources and ignores older playlists", () => {
    const prev = base({ images: [img("a")], events: [ev("e", "2026-03-10T15:00:00Z", "2026-03-10T16:00:00Z")] });
    const next = base({ serverTime: 2000, degraded: ["drive"], images: [], events: [] });
    const m = mergePlaylist(prev, next);
    expect(m.images.map((i) => i.id)).toEqual(["a"]);
    expect(m.events).toEqual([]);
    expect(mergePlaylist(base({ serverTime: 3000 }), base({ serverTime: 2000 })).serverTime).toBe(3000);
  });
});

describe("sequence", () => {
  const kinds = (steps: ReturnType<typeof sequence>) =>
    steps.map((s) => (s.slide.kind === "image" ? s.slide.id : s.slide.kind === "weather" ? "wx" : `cal${s.page + 1}`));
  it("matches the player order and rotates calendar pages", () => {
    expect(kinds(sequence(9, ["a", "b", "c"], 2, 2))).toEqual(["a", "b", "cal1", "c", "a", "cal2", "b", "c", "cal1"]);
  });
  it("puts weather right after the calendar", () => {
    expect(kinds(sequence(7, ["a", "b"], 2, 1, true)).map((k) => k)).toEqual([
      "a", "cal1", "wx", "b", "cal2", "wx", "a",
    ]);
  });
  it("skips the calendar without events and is empty with nothing to show", () => {
    expect(kinds(sequence(4, ["a", "b"], 0, 1))).toEqual(["a", "b", "a", "b"]);
    expect(sequence(3, [], 0, 5)).toEqual([]);
    expect(kinds(sequence(3, [], 2, 5))).toEqual(["cal1", "cal2", "cal1"]);
  });
});

describe("previewCycle", () => {
  const names = (c: ReturnType<typeof previewCycle>) =>
    c.map((s) => (s.slide.kind === "image" ? s.slide.id : s.slide.kind === "weather" ? "wx" : `cal${s.page + 1}`));
  it("lists images only", () => {
    expect(names(previewCycle(["a", "b"], 0, false))).toEqual(["a", "b"]);
  });
  it("adds each calendar page once after the images", () => {
    expect(names(previewCycle(["a", "b"], 2, false))).toEqual(["a", "b", "cal1", "cal2"]);
  });
  it("adds weather last", () => {
    expect(names(previewCycle(["a"], 2, true))).toEqual(["a", "cal1", "cal2", "wx"]);
    expect(names(previewCycle([], 0, true))).toEqual(["wx"]);
  });
  it("is empty with nothing to show", () => {
    expect(previewCycle([], 0, false)).toEqual([]);
  });
});
