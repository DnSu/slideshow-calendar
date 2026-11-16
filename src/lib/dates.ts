/** Day strings are `YYYY-MM-DD` in a given IANA timezone. */
export type Day = string;

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDay(s: string): boolean {
  const m = DAY_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock fields of `ms` in `tz`. */
function wallClock(ms: number, tz: string) {
  const out: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** The calendar day that `ms` falls on in `tz`. */
export function dayInTz(ms: number, tz: string): Day {
  const w = wallClock(ms, tz);
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}`;
}

export function addDays(day: Day, n: number): Day {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function lastDayOfMonth(year: number, month: number): Day {
  const d = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${pad(year, 4)}-${pad(month)}-${pad(d)}`;
}

function offsetAt(ms: number, tz: string): number {
  const w = wallClock(ms, tz);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(ms / 1000) * 1000;
}

/** The instant at which `day` starts (00:00) in `tz`. */
export function zonedMidnight(day: Day, tz: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let ts = guess - offsetAt(guess, tz);
  const second = guess - offsetAt(ts, tz);
  if (second !== ts) ts = second;
  return ts;
}
