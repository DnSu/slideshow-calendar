import { dayInTz, isValidDay, lastDayOfMonth, type Day } from "./dates";

/** Inclusive date window. `null` means unbounded on that side. */
export type DateWindow = { start: Day | null; end: Day | null };

export const ALWAYS: DateWindow = { start: null, end: null };

export type ParsedFolder =
  | { ok: true; window: DateWindow }
  | { ok: false; reason: string };

const MONTH_RE = /^(\d{4})-(\d{2})$/;

/**
 * Folder names:
 *   YYYY-MM                 shown until the last day of that month
 *   YYYY-MM-DD              shown until that day
 *   YYYY-MM-DD YYYY-MM-DD   shown from the first day through the second (inclusive)
 */
export function parseFolderName(name: string): ParsedFolder {
  const parts = name.trim().split(/\s+/);
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
  return (window.start === null || today >= window.start) && (window.end === null || today <= window.end);
}

/** Is the window active at instant `nowMs`, counting whole days in `tz`? */
export function isActive(window: DateWindow, nowMs: number, tz: string): boolean {
  return isActiveOnDay(window, dayInTz(nowMs, tz));
}
