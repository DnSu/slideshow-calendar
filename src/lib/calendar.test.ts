import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  feedUrl,
  fetchEvents,
  cleanDescription,
  parseIcs,
} from "@/lib/calendar";

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

describe("calendar feed", () => {
  it("builds the public feed URL from the calendar ID", () => {
    expect(feedUrl("fake@group.calendar.google.com")).toBe(
      "https://calendar.google.com/calendar/ical/fake%40group.calendar.google.com/public/basic.ics",
    );
  });
  it("parses a good feed", async () => {
    vi.stubGlobal("fetch", respond(fixture("calendar.ics")));
    const events = await fetchEvents(
      "fake",
      30,
      "UTC",
      Date.parse("2026-03-01T00:00:00Z"),
    );
    expect(events.length).toBeGreaterThan(0);
  });
  it("throws on an HTTP error or a page that isn't iCalendar", async () => {
    vi.stubGlobal("fetch", respond("nope", 404));
    await expect(fetchEvents("fake", 30, "UTC")).rejects.toThrow("HTTP 404");
    vi.stubGlobal("fetch", respond("<html>Sign in</html>"));
    await expect(fetchEvents("fake", 30, "UTC")).rejects.toThrow(
      "not iCalendar",
    );
  });
});

describe("parseIcs", () => {
  const range = {
    from: Date.parse("2026-03-09T00:00:00Z"),
    to: Date.parse("2026-04-08T00:00:00Z"),
  };
  const ics = fixture("calendar.ics");

  it("returns events in range, expands repeats, and skips cancelled/past", () => {
    const events = parseIcs(ics, range, "UTC");
    expect(
      events.map((e) => `${e.title}@${new Date(e.start).toISOString()}`),
    ).toEqual([
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
    const standups = parseIcs(ics, range, "UTC").filter(
      (e) => e.title === "Weekly standup",
    );
    expect(standups.map((e) => e.startDay)).toEqual([
      "2026-03-09",
      "2026-03-16",
      "2026-03-23",
      "2026-03-30",
      "2026-04-06",
    ]);
    expect(
      parseIcs(ics, range, "UTC").some(
        (e) => e.title === "Cancelled thing" || e.title === "Long past",
      ),
    ).toBe(false);
  });

  it("handles all-day events (end exclusive) in the configured timezone", () => {
    const open = parseIcs(ics, range, "America/New_York").find(
      (e) => e.title === "Open house",
    )!;
    expect(open.allDay).toBe(true);
    expect(open.startDay).toBe("2026-03-12");
    expect(open.endDay).toBe("2026-03-13");
    expect(open.start).toBe(Date.parse("2026-03-12T04:00:00Z"));
    expect(open.end).toBe(Date.parse("2026-03-14T04:00:00Z"));
  });

  it("cleans descriptions and carries location", () => {
    const meeting = parseIcs(ics, range, "UTC").find(
      (e) => e.title === "Team meeting",
    )!;
    expect(meeting.location).toBe("Room 1");
    expect(meeting.description).toBe("Bring notes & laptop\nSecond line");
  });

  it("parses an empty calendar to zero events", () => {
    expect(parseIcs(fixture("calendar-empty.ics"), range, "UTC")).toEqual([]);
    expect(parseIcs("BEGIN:VCALENDAR\nEND:VCALENDAR", range, "UTC")).toEqual(
      [],
    );
  });
});

describe("cleanDescription", () => {
  it("strips HTML, decodes entities and shortens", () => {
    expect(
      cleanDescription("<a href='x'>Link</a>&nbsp;&lt;ok&gt; &#169;"),
    ).toBe("Link <ok> ©");
    const long = cleanDescription("word ".repeat(100), 50);
    expect(long.length).toBeLessThanOrEqual(51);
    expect(long.endsWith("…")).toBe(true);
  });
});
