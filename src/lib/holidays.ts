import { addDays, isValidDay, lastDayOfMonth, type Day } from "./dates";

/**
 * When a holiday falls each year. JSON-safe: it travels to the screens inside the playlist.
 * `date`: a fixed month and day. `weekday`: the `nth` (1-4, or -1 for last) `weekday`
 * (0 = Sunday) of `month`. Months are 1-12.
 */
export type HolidayRule =
  | { kind: "date"; month: number; day: number }
  | { kind: "weekday"; month: number; weekday: number; nth: number };

/** A holiday rule plus how many days before and after the holiday its pictures show. */
export type HolidayWindow = { rule: HolidayRule; before: number; after: number };

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const EXTRA_WEEKDAYS: Record<string, number> = { tues: 2, thur: 4, thurs: 4 };
const NTH: Record<string, number> = {
  first: 1,
  "1st": 1,
  second: 2,
  "2nd": 2,
  third: 3,
  "3rd": 3,
  fourth: 4,
  "4th": 4,
  last: -1,
};

/** Full name or its first three letters ("sept" too). 1-12, or 0 if not a month. */
function monthOf(word: string): number {
  if (word === "sept") return 9;
  return MONTHS.findIndex((m) => m === word || m.slice(0, 3) === word) + 1;
}

/** Full name, first three letters, "tues", "thur" or "thurs". 0-6, or -1 if not a weekday. */
function weekdayOf(word: string): number {
  if (Object.hasOwn(EXTRA_WEEKDAYS, word)) return EXTRA_WEEKDAYS[word];
  return WEEKDAYS.findIndex((d) => d === word || d.slice(0, 3) === word);
}

const FIXED_RE = /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?$/;
const WEEKDAY_RE = /^([a-z0-9]+)\s+([a-z]+)\s+(?:in|of)\s+([a-z]+)$/;

/**
 * Parse the date part of a holiday folder name (any " - description" already removed):
 *   "July 4", "Dec 31", "June 19th"
 *   "Third Monday in February", "3rd Mon of Feb", "Last Monday in May"
 * Case doesn't matter; a dot after an abbreviation is allowed. Returns null if not understood.
 */
export function parseHolidayRule(text: string): HolidayRule | null {
  const s = text.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  const fixed = FIXED_RE.exec(s);
  if (fixed) {
    const month = monthOf(fixed[1]);
    const day = Number(fixed[2]);
    // Checked against a leap year so "February 29" is allowed (it only shows in leap years).
    if (!month || !isValidDay(`2000-${pad2(month)}-${pad2(day)}`)) return null;
    return { kind: "date", month, day };
  }
  const nth = WEEKDAY_RE.exec(s);
  if (nth && Object.hasOwn(NTH, nth[1])) {
    const weekday = weekdayOf(nth[2]);
    const month = monthOf(nth[3]);
    if (weekday < 0 || !month) return null;
    return { kind: "weekday", month, weekday, nth: NTH[nth[1]] };
  }
  return null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const pad4 = (n: number) => String(n).padStart(4, "0");

/** Day of the week (0 = Sunday) of a valid day. */
function weekdayOfDay(day: Day): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The holiday's date in `year`, or null if it has none that year (February 29). */
export function holidayDate(rule: HolidayRule, year: number): Day | null {
  const month = `${pad4(year)}-${pad2(rule.month)}`;
  if (rule.kind === "date") {
    const day = `${month}-${pad2(rule.day)}`;
    return isValidDay(day) ? day : null;
  }
  if (rule.nth === -1) {
    const last = lastDayOfMonth(year, rule.month);
    return addDays(last, -((weekdayOfDay(last) - rule.weekday + 7) % 7));
  }
  const first = `${month}-01`;
  return addDays(first, ((rule.weekday - weekdayOfDay(first) + 7) % 7) + (rule.nth - 1) * 7);
}

/**
 * The occurrence whose window is current or next on `today`: the holiday's date and its
 * window (`before` days ahead of it through `after` days past it, inclusive). Looks at last
 * year, this year and next year, so windows that cross New Year work.
 */
export function holidayOccurrence(
  w: HolidayWindow,
  today: Day,
): { date: Day; start: Day; end: Day } | null {
  const year = Number(today.slice(0, 4));
  for (const y of [year - 1, year, year + 1]) {
    const date = holidayDate(w.rule, y);
    if (!date) continue;
    const end = addDays(date, w.after);
    if (end >= today) return { date, start: addDays(date, -w.before), end };
  }
  return null;
}

/** Is `today` inside the holiday's window? */
export function isHolidayActive(w: HolidayWindow, today: Day): boolean {
  const occ = holidayOccurrence(w, today);
  return occ !== null && occ.start <= today;
}

const ORDINALS: Record<number, string> = { 1: "first", 2: "second", 3: "third", 4: "fourth", [-1]: "last" };
const title = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "July 4" or "the fourth Thursday in November". */
export function holidayRuleLabel(rule: HolidayRule): string {
  const month = title(MONTHS[rule.month - 1]);
  if (rule.kind === "date") return `${month} ${rule.day}`;
  return `the ${ORDINALS[rule.nth]} ${title(WEEKDAYS[rule.weekday])} in ${month}`;
}
