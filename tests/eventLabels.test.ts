import { describe, expect, it } from "vitest";
import { isMultiDay, spanLabel, timeLabel } from "@/lib/eventLabels";
import type { PlaylistEvent } from "@/lib/types";

const ev = (over: Partial<PlaylistEvent>): PlaylistEvent => ({
  id: "x", title: "x", location: "", description: "", allDay: false,
  start: 0, end: 0, startDay: "2026-11-20", endDay: "2026-11-20", ...over,
});

describe("event labels", () => {
  const tz = "UTC";
  it("single-day events have no span line", () => {
    const e = ev({ start: Date.parse("2026-11-20T19:00:00Z"), end: Date.parse("2026-11-20T20:00:00Z") });
    expect(isMultiDay(e)).toBe(false);
    expect(timeLabel(e, "2026-11-20", tz)).toBe("7:00 PM");
    expect(spanLabel(e, "2026-11-20", tz)).toBeNull();
  });

  it("upcoming all-day multi-day event shows its range and length", () => {
    const e = ev({ allDay: true, startDay: "2026-11-20", endDay: "2026-11-23" });
    expect(timeLabel(e, "2026-11-20", tz)).toBe("All day");
    expect(spanLabel(e, "2026-11-20", tz)).toBe("Fri, Nov 20 – Mon, Nov 23 · 4 days");
  });

  it("running all-day multi-day event shows progress", () => {
    const e = ev({ allDay: true, startDay: "2026-11-20", endDay: "2026-11-23" });
    expect(spanLabel(e, "2026-11-21", tz)).toBe("Day 2 of 4 · through Mon, Nov 23");
  });

  it("timed multi-day event: start time first, then Ongoing with end time", () => {
    const e = ev({
      start: Date.parse("2026-11-20T19:00:00Z"), end: Date.parse("2026-11-22T11:00:00Z"),
      startDay: "2026-11-20", endDay: "2026-11-22",
    });
    expect(timeLabel(e, "2026-11-20", tz)).toBe("7:00 PM");
    expect(spanLabel(e, "2026-11-20", tz)).toBe("Fri, Nov 20, 7:00 PM – Sun, Nov 22, 11:00 AM");
    expect(timeLabel(e, "2026-11-21", tz)).toBe("Ongoing");
    expect(spanLabel(e, "2026-11-21", tz)).toBe("Day 2 of 3 · until Sun, Nov 22, 11:00 AM");
  });
});
