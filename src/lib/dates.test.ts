import { describe, expect, it } from "vitest";
import {
  addDays,
  dayInTz,
  isValidDay,
  isValidTimezone,
  lastDayOfMonth,
  zonedMidnight,
} from "@/lib/dates";

describe("dates", () => {
  it("validates calendar days, including leap years", () => {
    expect(isValidDay("2026-12-31")).toBe(true);
    expect(isValidDay("2028-02-29")).toBe(true);
    expect(isValidDay("2026-02-29")).toBe(false);
    expect(isValidDay("2026-13-01")).toBe(false);
    expect(isValidDay("2026-3-7")).toBe(false);
    expect(isValidDay("")).toBe(false);
  });

  it("validates IANA timezones", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("finds the last day of a month", () => {
    expect(lastDayOfMonth(2026, 12)).toBe("2026-12-31");
    expect(lastDayOfMonth(2026, 2)).toBe("2026-02-28");
    expect(lastDayOfMonth(2028, 2)).toBe("2028-02-29");
    expect(lastDayOfMonth(2026, 4)).toBe("2026-04-30");
  });

  it("finds local midnight, including on daylight-saving change days", () => {
    const tz = "America/New_York";
    // Winter (UTC-5) and summer (UTC-4).
    expect(new Date(zonedMidnight("2026-01-15", tz)).toISOString()).toBe(
      "2026-01-15T05:00:00.000Z",
    );
    expect(new Date(zonedMidnight("2026-07-15", tz)).toISOString()).toBe(
      "2026-07-15T04:00:00.000Z",
    );
    // Clocks change at 2 AM, so midnight keeps the old offset on both change days.
    expect(new Date(zonedMidnight("2026-03-08", tz)).toISOString()).toBe(
      "2026-03-08T05:00:00.000Z",
    );
    expect(new Date(zonedMidnight("2026-11-01", tz)).toISOString()).toBe(
      "2026-11-01T04:00:00.000Z",
    );
    // Round trip: midnight belongs to that day, a millisecond earlier to the day before.
    const m = zonedMidnight("2026-11-01", tz);
    expect(dayInTz(m, tz)).toBe("2026-11-01");
    expect(dayInTz(m - 1, tz)).toBe("2026-10-31");
  });
});

describe("date helpers", () => {
  it("adds days across month and year edges", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("finds local midnight across DST", () => {
    // US DST starts 2026-03-08: midnight is still UTC-5, next midnight UTC-4
    expect(zonedMidnight("2026-03-08", "America/New_York")).toBe(
      Date.parse("2026-03-08T05:00:00Z"),
    );
    expect(zonedMidnight("2026-03-09", "America/New_York")).toBe(
      Date.parse("2026-03-09T04:00:00Z"),
    );
    expect(
      dayInTz(Date.parse("2026-03-09T03:59:00Z"), "America/New_York"),
    ).toBe("2026-03-08");
  });
});
