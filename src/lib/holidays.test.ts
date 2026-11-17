import { describe, expect, it } from "vitest";
import {
  holidayDate,
  holidayOccurrence,
  holidayRuleLabel,
  isHolidayActive,
  parseHolidayRule,
  type HolidayRule,
} from "@/lib/holidays";

const date = (month: number, day: number): HolidayRule => ({ kind: "date", month, day });
const nth = (n: number, weekday: number, month: number): HolidayRule => ({
  kind: "weekday",
  month,
  weekday,
  nth: n,
});

describe("parseHolidayRule", () => {
  it("reads fixed dates", () => {
    expect(parseHolidayRule("July 4")).toEqual(date(7, 4));
    expect(parseHolidayRule("dec 31")).toEqual(date(12, 31));
    expect(parseHolidayRule("June 19th")).toEqual(date(6, 19));
    expect(parseHolidayRule("Sept. 1")).toEqual(date(9, 1));
    expect(parseHolidayRule("  NOVEMBER   11 ")).toEqual(date(11, 11));
    expect(parseHolidayRule("February 29")).toEqual(date(2, 29));
  });
  it("reads nth and last weekdays", () => {
    expect(parseHolidayRule("Third Monday in February")).toEqual(nth(3, 1, 2));
    expect(parseHolidayRule("3rd Mon of Feb")).toEqual(nth(3, 1, 2));
    expect(parseHolidayRule("Last Monday in May")).toEqual(nth(-1, 1, 5));
    expect(parseHolidayRule("fourth thurs in nov")).toEqual(nth(4, 4, 11));
    expect(parseHolidayRule("First Tues. of Sept.")).toEqual(nth(1, 2, 9));
  });
  it("rejects anything else", () => {
    for (const s of [
      "",
      "Thanksgiving",
      "Third Month in Feb",
      "Fifth Monday in May",
      "July 32",
      "February 30",
      "Juli 4",
      "4 July",
      "Monday in May",
      "Last Monday May",
      "0000-07-04",
    ]) {
      expect(parseHolidayRule(s), s).toBeNull();
    }
  });
});

describe("holidayDate", () => {
  it("finds US holidays", () => {
    expect(holidayDate(nth(3, 1, 1), 2027)).toBe("2027-01-18"); // MLK Day
    expect(holidayDate(nth(3, 1, 2), 2026)).toBe("2026-02-16"); // Washington's Birthday
    expect(holidayDate(nth(-1, 1, 5), 2026)).toBe("2026-05-25"); // Memorial Day
    expect(holidayDate(nth(-1, 1, 5), 2027)).toBe("2027-05-31"); // May with five Mondays
    expect(holidayDate(nth(1, 1, 9), 2026)).toBe("2026-09-07"); // Labor Day
    expect(holidayDate(nth(4, 4, 11), 2026)).toBe("2026-11-26"); // Thanksgiving
    expect(holidayDate(nth(4, 4, 11), 2029)).toBe("2029-11-22");
    expect(holidayDate(nth(1, 1, 6), 2026)).toBe("2026-06-01"); // month starting on that weekday
    expect(holidayDate(date(7, 4), 2026)).toBe("2026-07-04");
  });
  it("skips February 29 outside leap years", () => {
    expect(holidayDate(date(2, 29), 2028)).toBe("2028-02-29");
    expect(holidayDate(date(2, 29), 2027)).toBeNull();
  });
});

describe("holiday windows", () => {
  const thanksgiving = { rule: nth(4, 4, 11), before: 7, after: 1 };
  it("shows from 7 days before through 1 day after", () => {
    expect(holidayOccurrence(thanksgiving, "2026-11-17")).toEqual({
      date: "2026-11-26",
      start: "2026-11-19",
      end: "2026-11-27",
    });
    expect(isHolidayActive(thanksgiving, "2026-11-18")).toBe(false);
    expect(isHolidayActive(thanksgiving, "2026-11-19")).toBe(true);
    expect(isHolidayActive(thanksgiving, "2026-11-27")).toBe(true);
    expect(isHolidayActive(thanksgiving, "2026-11-28")).toBe(false);
  });
  it("moves on to next year once this year's window is over", () => {
    expect(holidayOccurrence(thanksgiving, "2026-11-28")?.date).toBe("2027-11-25");
  });
  it("crosses New Year", () => {
    const newYear = { rule: date(1, 1), before: 7, after: 1 };
    expect(isHolidayActive(newYear, "2026-12-24")).toBe(false);
    expect(isHolidayActive(newYear, "2026-12-25")).toBe(true);
    expect(holidayOccurrence(newYear, "2026-12-25")?.date).toBe("2027-01-01");
    expect(isHolidayActive(newYear, "2027-01-02")).toBe(true);
    expect(isHolidayActive(newYear, "2027-01-03")).toBe(false);
    const nye = { rule: date(12, 31), before: 7, after: 1 };
    expect(isHolidayActive(nye, "2027-01-01")).toBe(true);
    expect(holidayOccurrence(nye, "2027-01-01")?.date).toBe("2026-12-31");
  });
  it("honours other day counts", () => {
    const july4 = { rule: date(7, 4), before: 0, after: 0 };
    expect(isHolidayActive(july4, "2026-07-03")).toBe(false);
    expect(isHolidayActive(july4, "2026-07-04")).toBe(true);
    expect(isHolidayActive(july4, "2026-07-05")).toBe(false);
  });
});

describe("holidayRuleLabel", () => {
  it("describes rules", () => {
    expect(holidayRuleLabel(date(7, 4))).toBe("July 4");
    expect(holidayRuleLabel(nth(4, 4, 11))).toBe("the fourth Thursday in November");
    expect(holidayRuleLabel(nth(-1, 1, 5))).toBe("the last Monday in May");
  });
});
