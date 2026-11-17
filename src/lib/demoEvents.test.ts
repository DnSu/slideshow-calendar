import { describe, expect, it } from "vitest";
import { demoEvents } from "@/lib/demoEvents";
import { eventPages } from "@/lib/events";

const NOW = Date.parse("2026-11-16T15:00:00Z");

describe("demoEvents", () => {
  it("is well-formed, has upcoming events and needs more than one page", () => {
    const events = demoEvents(NOW, "America/New_York");
    expect(events.length).toBeGreaterThan(8);
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    for (const e of events) expect(e.end).toBeGreaterThan(e.start);
    expect(events.some((e) => e.start < NOW && e.end > NOW)).toBe(true); // something running
    const pages = eventPages(events, NOW, "America/New_York", {
      eventsPerPage: 8,
    });
    expect(pages.length).toBeGreaterThan(1);
  });
});
