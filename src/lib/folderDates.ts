import { dayInTz, isValidDay, lastDayOfMonth, type Day } from "./dates";

/** Month and day, "MM-DD". */
export type MonthDay = string;

/**
 * Inclusive date window. `null` means unbounded on that side.
 * `yearly` (from "0000-…" folder names) repeats every year and ignores `start`/`end`;
 * `from` > `to` means it wraps over New Year (e.g. 12-15 → 01-05).
 */
export type DateWindow = {
  start: Day | null;
  end: Day | null;
  yearly?: { from: MonthDay; to: MonthDay };
};

export const ALWAYS: DateWindow = { start: null, end: null };

export type ParsedFolder =
  | { ok: true; window: DateWindow }
  | { ok: false; reason: string };

const MONTH_RE = /^(\d{4})-(\d{2})$/;
const YEARLY_DAY_RE = /^0000-(\d{2})-(\d{2})$/;
const YEARLY_MONTH_RE = /^0000-(\d{2})$/;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Parse a yearly part ("0000-MM-DD" or "0000-MM") into its first and last month-day. */
function yearlyPart(s: string): { first: MonthDay; last: MonthDay } | null {
  const d = YEARLY_DAY_RE.exec(s);
  if (d) {
    // Validate against a leap year so 0000-02-29 is allowed (it only matches in leap years).
    if (!isValidDay(`2000-${d[1]}-${d[2]}`)) return null;
    const md = `${d[1]}-${d[2]}`;
    return { first: md, last: md };
  }
  const m = YEARLY_MONTH_RE.exec(s);
  if (m) {
    const month = Number(m[1]);
    if (month < 1 || month > 12) return null;
    return { first: `${pad2(month)}-01`, last: lastDayOfMonth(2000, month).slice(5) };
  }
  return null;
}

const isYearly = (s: string) => s.startsWith("0000-");

/**
 * Folder names:
 *   YYYY-MM                 shown until the last day of that month
 *   YYYY-MM-DD              shown until that day
 *   YYYY-MM-DD YYYY-MM-DD   shown from the first day through the second (inclusive)
 * Yearly (year 0000, repeats every year):
 *   0000-MM                 that whole month
 *   0000-MM-DD              that day
 *   0000-MM-DD 0000-MM-DD   from the first day through the second; may wrap over New Year
 *   0000-MM 0000-MM         from the first month through the end of the second
 */
export function parseFolderName(name: string): ParsedFolder {
  const parts = name.trim().split(/\s+/);
  if (parts.some(isYearly)) {
    if (!parts.every(isYearly)) return { ok: false, reason: "mixes yearly (0000) and dated parts" };
    if (parts.length > 2) return { ok: false, reason: "unrecognised folder name" };
    const a = yearlyPart(parts[0]);
    const b = parts.length === 2 ? yearlyPart(parts[1]) : a;
    if (!a || !b) return { ok: false, reason: "invalid yearly date" };
    return { ok: true, window: { start: null, end: null, yearly: { from: a.first, to: b.last } } };
  }
  if (parts.length === 1) {
    const mm = MONTH_RE.exec(parts[0]);
    if (mm) {
      const year = Number(mm[1]);
      const month = Number(mm[2]);
      if (month < 1 || month > 12) return { ok: false, reason: "month out of range" };
      return { ok: true, window: { start: null, end: lastDayOfMonth(year, month) } };
    }
    if (isValidDay(parts[0])) return { ok: true, window: { start: null, end: parts[0] } };
    return { ok: false, reason: "not a date" };
  }
  if (parts.length === 2) {
    const [a, b] = parts;
    if (!isValidDay(a) || !isValidDay(b)) return { ok: false, reason: "invalid date in range" };
    if (b < a) return { ok: false, reason: "end before start" };
    return { ok: true, window: { start: a, end: b } };
  }
  return { ok: false, reason: "unrecognised folder name" };
}

export function isActiveOnDay(window: DateWindow, today: Day): boolean {
  if (window.yearly) {
    const md = today.slice(5);
    const { from, to } = window.yearly;
    return from <= to ? md >= from && md <= to : md >= from || md <= to;
  }
  return (window.start === null || today >= window.start) && (window.end === null || today <= window.end);
}

/** Is the window active at instant `nowMs`, counting whole days in `tz`? */
export function isActive(window: DateWindow, nowMs: number, tz: string): boolean {
  return isActiveOnDay(window, dayInTz(nowMs, tz));
}
