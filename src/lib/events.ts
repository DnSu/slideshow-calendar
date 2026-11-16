import { dayInTz, type Day } from "./dates";
import type { PlaylistEvent } from "./types";

export type DayGroup = { day: Day; events: PlaylistEvent[] };
/** One calendar page: up to `eventsPerPage` events, grouped by day. */
export type EventPage = DayGroup[];

/** All upcoming events (still running or not yet started), soonest first. */
export function upcomingEvents(events: PlaylistEvent[], nowMs: number): PlaylistEvent[] {
  return events
    .filter((e) => e.end >= nowMs)
    .sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
}

/**
 * Split all upcoming events into pages of `eventsPerPage`, each grouped by day. A multi-day
 * event that is already running is grouped under today. No upcoming events → no pages.
 * A day can continue onto the next page; its heading is repeated there.
 */
export function eventPages(
  events: PlaylistEvent[],
  nowMs: number,
  tz: string,
  opts: { eventsPerPage: number },
): EventPage[] {
  const today = dayInTz(nowMs, tz);
  const upcoming = upcomingEvents(events, nowMs);
  const pages: EventPage[] = [];
  for (let i = 0; i < upcoming.length; i += opts.eventsPerPage) {
    const groups: DayGroup[] = [];
    for (const e of upcoming.slice(i, i + opts.eventsPerPage)) {
      const day = e.startDay > today ? e.startDay : today;
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.events.push(e);
      else groups.push({ day, events: [e] });
    }
    pages.push(groups);
  }
  return pages;
}
