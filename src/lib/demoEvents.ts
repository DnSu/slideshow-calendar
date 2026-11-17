import { addDays, dayInTz, zonedMidnight } from "./dates";
import type { PlaylistEvent } from "./types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Made-up events relative to `nowMs`, for the /calendar preview (`?demo`). Covers a running
 * event, timed and all-day events, locations, long descriptions, and a weekly repeat, and is
 * long enough to need more than one page.
 */
export function demoEvents(nowMs: number, tz: string): PlaylistEvent[] {
  const hourStart = Math.floor(nowMs / HOUR) * HOUR;
  const make = (
    id: string,
    title: string,
    startOffset: number,
    length: number,
    extra: Partial<PlaylistEvent> = {},
  ): PlaylistEvent => {
    const start = hourStart + startOffset;
    const end = start + length;
    return {
      id,
      title,
      location: "",
      description: "",
      allDay: false,
      start,
      end,
      startDay: dayInTz(start, tz),
      endDay: dayInTz(end - 1, tz),
      ...extra,
    };
  };

  const events = [
    make("running", "Lobby coffee hour", -HOUR, 2 * HOUR, { location: "Main lobby" }),
    make("later-today", "Building tour", 3 * HOUR, HOUR, {
      location: "Meet at the front desk",
      description: "A short walk through the shared spaces. All residents and guests welcome.",
    }),
    make("tomorrow", "Package room closed for cleaning", DAY, 4 * HOUR),
    make("all-day", "Fire alarm testing", 2 * DAY, DAY, {
      allDay: true,
      description:
        "Alarms will sound briefly throughout the day as each floor is tested. No action is needed. " +
        "This description is deliberately long to check that it is shortened cleanly on screen.",
    }),
    make("evening", "Community meeting", 3 * DAY + 2 * HOUR, 90 * 60_000, {
      location: "Community room, 2nd floor",
      description: "Agenda: lobby renovation, holiday decorations, open questions.",
    }),
  ];
  // Multi-day: one running since yesterday (timed), one upcoming (all-day, 3 days).
  events.push(
    make("elections", "Board elections (voting open)", -DAY - 2 * HOUR, 2 * DAY + 4 * HOUR, {
      location: "Management office",
      description: "Drop your ballot in the box any time voting is open.",
    }),
  );
  const holidayFirst = addDays(dayInTz(nowMs, tz), 4);
  const holidayLast = addDays(holidayFirst, 2);
  events.push({
    id: "holiday",
    title: "Holiday weekend – office closed",
    location: "",
    description: "Emergency maintenance only. Call the front desk.",
    allDay: true,
    start: zonedMidnight(holidayFirst, tz),
    end: zonedMidnight(addDays(holidayLast, 1), tz),
    startDay: holidayFirst,
    endDay: holidayLast,
  });
  for (let week = 0; week < 6; week++) {
    events.push(
      make(`yoga-${week}`, "Morning yoga", (week * 7 + 1) * DAY + 5 * HOUR, HOUR, {
        location: "Roof deck",
        description: "Every week. Bring your own mat.",
      }),
    );
  }
  return events;
}
