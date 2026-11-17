import { holidayRuleLabel } from "./holidays";
import type { PlaylistImage } from "./types";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}

/** "06-25" → "Jun 25th". Falls back to the input if it isn't a valid MM-DD. */
export function monthDayLabel(md: string): string {
  const m = /^(\d{2})-(\d{2})$/.exec(md);
  const month = m ? MONTHS[Number(m[1]) - 1] : undefined;
  return m && month ? `${month} ${ordinal(Number(m[2]))}` : md;
}

/** "2026-12-31" → "Dec 31st, 2026" (or without the year). */
export function dayLabel(day: string, withYear = true): string {
  const label = monthDayLabel(day.slice(5));
  return withYear ? `${label}, ${day.slice(0, 4)}` : label;
}

/** When an image shows, in words: "every year Jun 25th to Jul 5th", "until Dec 31st, 2026"… */
export function windowLabel(
  i: Pick<PlaylistImage, "start" | "end" | "yearly" | "holiday">,
): string {
  if (i.holiday) {
    const { rule, before, after } = i.holiday;
    const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
    return `every year, ${days(before)} before to ${days(after)} after ${holidayRuleLabel(rule)}`;
  }
  if (i.yearly) {
    const from = monthDayLabel(i.yearly.from);
    return i.yearly.from === i.yearly.to
      ? `every year on ${from}`
      : `every year ${from} to ${monthDayLabel(i.yearly.to)}`;
  }
  if (!i.start && !i.end) return "always";
  if (!i.start) return `until ${dayLabel(i.end!)}`;
  if (!i.end) return `from ${dayLabel(i.start)}`;
  if (i.start === i.end) return `on ${dayLabel(i.start)}`;
  const sameYear = i.start.slice(0, 4) === i.end.slice(0, 4);
  return `${dayLabel(i.start, !sameYear)} to ${dayLabel(i.end)}`;
}
