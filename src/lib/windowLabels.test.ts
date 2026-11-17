import { describe, expect, it } from "vitest";
import {
  dayLabel,
  monthDayLabel,
  ordinal,
  windowLabel,
} from "@/lib/windowLabels";

describe("dayLabel", () => {
  it("formats a day with or without the year", () => {
    expect(dayLabel("2026-03-02")).toBe("Mar 2nd, 2026");
    expect(dayLabel("2026-03-02", false)).toBe("Mar 2nd");
  });
});

describe("windowLabel", () => {
  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "23rd",
      "31st",
    ]);
  });
  it("names months", () => {
    expect(monthDayLabel("06-25")).toBe("Jun 25th");
    expect(monthDayLabel("13-01")).toBe("13-01");
  });
  it("describes every-year windows", () => {
    const y = (from: string, to: string) =>
      windowLabel({ start: null, end: null, yearly: { from, to } });
    expect(y("06-25", "07-05")).toBe("every year Jun 25th to Jul 5th");
    expect(y("12-15", "01-05")).toBe("every year Dec 15th to Jan 5th");
    expect(y("12-25", "12-25")).toBe("every year on Dec 25th");
  });
  it("describes dated windows", () => {
    expect(windowLabel({ start: null, end: null })).toBe("always");
    expect(windowLabel({ start: null, end: "2026-12-31" })).toBe(
      "until Dec 31st, 2026",
    );
    expect(windowLabel({ start: "2026-12-01", end: "2026-12-31" })).toBe(
      "Dec 1st to Dec 31st, 2026",
    );
    expect(windowLabel({ start: "2026-12-20", end: "2027-01-02" })).toBe(
      "Dec 20th, 2026 to Jan 2nd, 2027",
    );
    expect(windowLabel({ start: "2026-12-24", end: "2026-12-24" })).toBe(
      "on Dec 24th, 2026",
    );
  });
});
