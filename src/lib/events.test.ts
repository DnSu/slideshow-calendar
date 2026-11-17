import { describe, expect, it } from "vitest";
import { eventPages, upcomingEvents } from "@/lib/events";
import type { PlaylistEvent } from "@/lib/types";

const NOW = Date.parse("2026-11-16T15:00:00Z");

const ev = (
  id: string,
  start: string,
  end: string,
  extra: Partial<PlaylistEvent> = {},
): PlaylistEvent => ({
  id,
  title: id,
  location: "",
  description: "",
  allDay: false,
  start: Date.parse(start),
  end: Date.parse(end),
  startDay: start.slice(0, 10),
  endDay: end.slice(0, 10),
  ...extra,
});

describe("upcomingEvents", () => {
  const ev = (
    id: string,
    start: string,
    end: string,
    title = id,
  ): PlaylistEvent => ({
    id,
    title,
    location: "",
    description: "",
    allDay: false,
    start: Date.parse(start),
    end: Date.parse(end),
    startDay: start.slice(0, 10),
    endDay: end.slice(0, 10),
  });
  it("drops ended events and sorts by start, then title", () => {
    const out = upcomingEvents(
      [
        ev("later", "2026-11-18T10:00:00Z", "2026-11-18T11:00:00Z"),
        ev("ended", "2026-11-15T10:00:00Z", "2026-11-15T11:00:00Z"),
        ev("b", "2026-11-17T10:00:00Z", "2026-11-17T11:00:00Z", "Beta"),
        ev("a", "2026-11-17T10:00:00Z", "2026-11-17T11:00:00Z", "Alpha"),
        ev("running", "2026-11-16T14:00:00Z", "2026-11-16T16:00:00Z"),
      ],
      NOW,
    );
    expect(out.map((e) => e.id)).toEqual(["running", "a", "b", "later"]);
  });
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
      [
        ["2026-03-10", ["now", "later"]],
        ["2027-02-01", ["far"]],
      ],
    ]);
  });
  it("splits into pages and repeats a day heading that spans pages", () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      ev(
        `e${i}`,
        `2026-03-1${Math.floor(i / 2) + 1}T1${i}:00:00Z`,
        `2026-03-1${Math.floor(i / 2) + 1}T1${i}:30:00Z`,
      ),
    );
    const pages = eventPages(many, now, "UTC", opts);
    expect(pages.map((p) => p.flatMap((g) => g.events).length)).toEqual([
      3, 3, 1,
    ]);
    expect(days(pages)[1][0]).toEqual(["2026-03-12", ["e3"]]);
    expect(eventPages([], now, "UTC", opts)).toEqual([]);
  });
  it("files a running multi-day event under today", () => {
    const e = ev("multi", "2026-03-08T00:00:00Z", "2026-03-12T00:00:00Z", {
      allDay: true,
    });
    expect(eventPages([e], now, "UTC", opts)[0][0].day).toBe("2026-03-10");
  });
});
