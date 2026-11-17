import { describe, expect, it } from "vitest";
import { isActive, parseFolderName, isActiveOnDay } from "@/lib/folderDates";

describe("parseFolderName", () => {
  it("parses YYYY-MM as until month end", () => {
    expect(parseFolderName("2026-12")).toEqual({
      ok: true,
      window: { start: null, end: "2026-12-31" },
    });
    expect(parseFolderName("2028-02")).toEqual({
      ok: true,
      window: { start: null, end: "2028-02-29" },
    });
    expect(parseFolderName("2026-02")).toEqual({
      ok: true,
      window: { start: null, end: "2026-02-28" },
    });
  });
  it("parses a single day and a range", () => {
    expect(parseFolderName("2026-12-31")).toEqual({
      ok: true,
      window: { start: null, end: "2026-12-31" },
    });
    expect(parseFolderName("2026-12-01 2026-12-31")).toEqual({
      ok: true,
      window: { start: "2026-12-01", end: "2026-12-31" },
    });
    expect(parseFolderName("2026-12-05 2026-12-05").ok).toBe(true);
  });
  it("ignores a trailing \" - description\"", () => {
    expect(parseFolderName("2026-12-01 2026-12-31 - Pool closed")).toEqual({
      ok: true,
      window: { start: "2026-12-01", end: "2026-12-31" },
    });
    expect(parseFolderName("2026-12 – Winter party")).toEqual({
      ok: true,
      window: { start: null, end: "2026-12-31" },
    });
    expect(parseFolderName("0000-12-15 0000-01-05 — Holidays - lobby")).toEqual({
      ok: true,
      window: { start: null, end: null, yearly: { from: "12-15", to: "01-05" } },
    });
    expect(parseFolderName("2026-12-31 - 2026 NYE")).toEqual({
      ok: true,
      window: { start: null, end: "2026-12-31" },
    });
  });
  it("reads a dash between two dates as a range", () => {
    expect(parseFolderName("2026-12-01 - 2026-12-31")).toEqual({
      ok: true,
      window: { start: "2026-12-01", end: "2026-12-31" },
    });
    expect(parseFolderName("2026-12-01 - 2026-12-31 - Pool closed").ok).toBe(true);
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
      "Pool closed - 2026-12-01",
      "2026-12-01-Pool closed",
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
    expect(isActive(range, at("2026-12-31T15:00:00Z"), "Asia/Tokyo")).toBe(
      false,
    );
  });
  it("handles month-only and open windows", () => {
    expect(
      isActive(
        { start: null, end: "2026-02-28" },
        at("2026-02-28T20:00:00Z"),
        "UTC",
      ),
    ).toBe(true);
    expect(
      isActive(
        { start: null, end: "2026-02-28" },
        at("2026-03-01T00:00:00Z"),
        "UTC",
      ),
    ).toBe(false);
    expect(
      isActive({ start: null, end: null }, at("2100-01-01T00:00:00Z"), "UTC"),
    ).toBe(true);
  });
});

describe("yearly folders (0000)", () => {
  const w = (name: string) => {
    const p = parseFolderName(name);
    if (!p.ok) throw new Error(`${name}: ${p.reason}`);
    return p.window;
  };
  const on = (name: string, day: string) =>
    isActive(w(name), Date.parse(`${day}T12:00:00Z`), "UTC");

  it("parses the yearly forms", () => {
    expect(w("0000-06-15 0000-07-05").yearly).toEqual({
      from: "06-15",
      to: "07-05",
    });
    expect(w("0000-06").yearly).toEqual({ from: "06-01", to: "06-30" });
    expect(w("0000-02").yearly).toEqual({ from: "02-01", to: "02-29" });
    expect(w("0000-12-25").yearly).toEqual({ from: "12-25", to: "12-25" });
    expect(w("0000-11 0000-12").yearly).toEqual({ from: "11-01", to: "12-31" });
  });

  it("matches the same days in any year, inclusive", () => {
    for (const year of ["2026", "2027", "2031"]) {
      expect(on("0000-06-15 0000-07-05", `${year}-06-15`)).toBe(true);
      expect(on("0000-06-15 0000-07-05", `${year}-07-05`)).toBe(true);
      expect(on("0000-06-15 0000-07-05", `${year}-06-14`)).toBe(false);
      expect(on("0000-06-15 0000-07-05", `${year}-07-06`)).toBe(false);
    }
    expect(on("0000-06", "2027-06-30")).toBe(true);
    expect(on("0000-06", "2027-07-01")).toBe(false);
    expect(on("0000-12-25", "2030-12-25")).toBe(true);
    expect(on("0000-12-25", "2030-12-26")).toBe(false);
  });

  it("wraps over New Year", () => {
    expect(on("0000-12-15 0000-01-05", "2026-12-31")).toBe(true);
    expect(on("0000-12-15 0000-01-05", "2027-01-05")).toBe(true);
    expect(on("0000-12-15 0000-01-05", "2027-01-06")).toBe(false);
    expect(on("0000-12-15 0000-01-05", "2026-12-14")).toBe(false);
  });

  it("handles Feb 29 and rejects bad names", () => {
    expect(on("0000-02-29", "2028-02-29")).toBe(true);
    expect(on("0000-02-29", "2027-02-28")).toBe(false);
    for (const bad of [
      "0000-13",
      "0000-02-30",
      "0000-06-15 2026-07-05",
      "0000-06-15 0000-07-05 0000-08-01",
      "0000",
    ]) {
      expect(parseFolderName(bad).ok, bad).toBe(false);
    }
  });
});

describe("isActiveOnDay", () => {
  const window = (name: string) => {
    const r = parseFolderName(name);
    if (!r.ok) throw new Error(r.reason);
    return r.window;
  };
  it("checks a plain day against dated and yearly windows", () => {
    expect(isActiveOnDay(window("2026-12-01 2026-12-31"), "2026-12-01")).toBe(
      true,
    );
    expect(isActiveOnDay(window("2026-12-01 2026-12-31"), "2026-11-30")).toBe(
      false,
    );
    expect(isActiveOnDay(window("0000-12-15 0000-01-05"), "2027-01-03")).toBe(
      true,
    );
    expect(isActiveOnDay(window("0000-12-15 0000-01-05"), "2027-01-06")).toBe(
      false,
    );
  });
});
