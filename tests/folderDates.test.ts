import { describe, expect, it } from "vitest";
import { addDays, dayInTz, zonedMidnight } from "@/lib/dates";
import { isActive, parseFolderName } from "@/lib/folderDates";

describe("parseFolderName", () => {
  it("parses YYYY-MM as until month end", () => {
    expect(parseFolderName("2026-12")).toEqual({ ok: true, window: { start: null, end: "2026-12-31" } });
    expect(parseFolderName("2028-02")).toEqual({ ok: true, window: { start: null, end: "2028-02-29" } });
    expect(parseFolderName("2026-02")).toEqual({ ok: true, window: { start: null, end: "2026-02-28" } });
  });
  it("parses a single day and a range", () => {
    expect(parseFolderName("2026-12-31")).toEqual({ ok: true, window: { start: null, end: "2026-12-31" } });
    expect(parseFolderName("2026-12-01 2026-12-31")).toEqual({
      ok: true,
      window: { start: "2026-12-01", end: "2026-12-31" },
    });
    expect(parseFolderName("2026-12-05 2026-12-05").ok).toBe(true);
  });
  it("rejects malformed names", () => {
    for (const n of [
      "Holiday",
      "2026-13",
      "2026-00",
      "2026-02-30",
      "2026-12-31 2026-12-01",
      "2026-12-01 2026-12-31 2027-01-01",
      "2026-1-1",
      "2026-12-01_2026-12-31",
      "",
    ]) {
      expect(parseFolderName(n).ok, n).toBe(false);
    }
  });
});

describe("isActive", () => {
  const range = { start: "2026-12-01", end: "2026-12-31" };
  const at = (iso: string) => Date.parse(iso);

  it("is inclusive of both end days", () => {
    expect(isActive(range, at("2026-12-01T12:00:00Z"), "UTC")).toBe(true);
    expect(isActive(range, at("2026-12-31T23:59:59Z"), "UTC")).toBe(true);
    expect(isActive(range, at("2026-11-30T23:59:59Z"), "UTC")).toBe(false);
    expect(isActive(range, at("2027-01-01T00:00:00Z"), "UTC")).toBe(false);
  });
  it("uses the configured timezone for day boundaries", () => {
    const ny = "America/New_York";
    // 2027-01-01T03:00Z is still Dec 31 in New York (UTC-5)
    expect(isActive(range, at("2027-01-01T03:00:00Z"), ny)).toBe(true);
    expect(isActive(range, at("2027-01-01T05:00:00Z"), ny)).toBe(false);
    // 2026-12-01T03:00Z is still Nov 30 in New York
    expect(isActive(range, at("2026-12-01T03:00:00Z"), ny)).toBe(false);
    expect(isActive(range, at("2026-12-01T05:00:00Z"), ny)).toBe(true);
    // Far east of UTC: already Jan 1
    expect(isActive(range, at("2026-12-31T15:00:00Z"), "Asia/Tokyo")).toBe(false);
  });
  it("handles month-only and open windows", () => {
    expect(isActive({ start: null, end: "2026-02-28" }, at("2026-02-28T20:00:00Z"), "UTC")).toBe(true);
    expect(isActive({ start: null, end: "2026-02-28" }, at("2026-03-01T00:00:00Z"), "UTC")).toBe(false);
    expect(isActive({ start: null, end: null }, at("2100-01-01T00:00:00Z"), "UTC")).toBe(true);
  });
});

describe("date helpers", () => {
  it("adds days across month and year edges", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("finds local midnight across DST", () => {
    // US DST starts 2026-03-08: midnight is still UTC-5, next midnight UTC-4
    expect(zonedMidnight("2026-03-08", "America/New_York")).toBe(Date.parse("2026-03-08T05:00:00Z"));
    expect(zonedMidnight("2026-03-09", "America/New_York")).toBe(Date.parse("2026-03-09T04:00:00Z"));
    expect(dayInTz(Date.parse("2026-03-09T03:59:00Z"), "America/New_York")).toBe("2026-03-08");
  });
});
