import type { Day } from "./dates";
import type { PlaylistEvent } from "./types";

/** Number of calendar days from `a` to `b` (b - a). */
function dayDiff(a: Day, b: Day): number {
  const ms = (d: Day) => {
    const [y, m, dd] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

function shortDay(day: Day): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function clock(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(
    new Date(ms),
  );
}

export function isMultiDay(e: PlaylistEvent): boolean {
  return e.endDay > e.startDay;
}

/**
 * The left-hand column for an event listed under `groupDay`: "All day", the start time, or
 * "Ongoing" for a timed multi-day event that started on an earlier day.
 */
export function timeLabel(e: PlaylistEvent, groupDay: Day, tz: string): string {
  if (e.allDay) return "All day";
  if (groupDay > e.startDay) return "Ongoing";
  return clock(e.start, tz);
}

/**
 * Extra line for multi-day events; null for single-day ones.
 *   Not started yet:  "Thu, Nov 20 – Sun, Nov 23 · 4 days"
 *                     "Thu, Nov 20, 7:00 PM – Sat, Nov 22, 11:00 AM" (timed)
 *   Already running:  "Day 2 of 4 · through Sun, Nov 23"
 *                     "Day 2 of 3 · until Sat, Nov 22, 11:00 AM" (timed)
 */
export function spanLabel(e: PlaylistEvent, groupDay: Day, tz: string): string | null {
  if (!isMultiDay(e)) return null;
  const total = dayDiff(e.startDay, e.endDay) + 1;
  if (groupDay > e.startDay) {
    const n = Math.min(dayDiff(e.startDay, groupDay) + 1, total);
    return e.allDay
      ? `Day ${n} of ${total} · through ${shortDay(e.endDay)}`
      : `Day ${n} of ${total} · until ${shortDay(e.endDay)}, ${clock(e.end, tz)}`;
  }
  return e.allDay
    ? `${shortDay(e.startDay)} – ${shortDay(e.endDay)} · ${total} days`
    : `${shortDay(e.startDay)}, ${clock(e.start, tz)} – ${shortDay(e.endDay)}, ${clock(e.end, tz)}`;
}
