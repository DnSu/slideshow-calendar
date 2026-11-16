import ical, { type VEvent, type ParameterValue } from "node-ical";
import { addDays, dayInTz, zonedMidnight } from "./dates";
import type { PlaylistEvent } from "./types";

const TIMEOUT_MS = 20_000;
const DESCRIPTION_MAX = 200;

export function feedUrl(calendarId: string) {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Remove HTML tags/entities, keep line breaks, collapse whitespace, shorten. */
export function cleanDescription(raw: string, max = DESCRIPTION_MAX): string {
  let s = raw
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  s = s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
  s = s
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, "") + "…";
  return s;
}

function text(v: ParameterValue | undefined): string {
  if (v === undefined || v === null) return "";
  return typeof v === "string" ? v : String(v.val ?? "");
}

type Range = { from: number; to: number };

/** node-ical builds date-only values at local midnight of the server. */
function dateOnlyDay(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function toEvent(
  uid: string,
  ev: VEvent,
  start: Date,
  end: Date | undefined,
  fullDay: boolean,
  tz: string,
): PlaylistEvent {
  let s: number;
  let e: number;
  let startDay: string;
  let endDay: string;
  if (fullDay) {
    startDay = dateOnlyDay(start);
    let endExclusive = end ? dateOnlyDay(end) : addDays(startDay, 1);
    if (endExclusive <= startDay) endExclusive = addDays(startDay, 1);
    endDay = addDays(endExclusive, -1);
    s = zonedMidnight(startDay, tz);
    e = zonedMidnight(endExclusive, tz);
  } else {
    s = start.getTime();
    e = Math.max(end ? end.getTime() : s, s);
    startDay = dayInTz(s, tz);
    endDay = dayInTz(e > s ? e - 1 : e, tz);
  }
  return {
    id: `${uid}|${s}`,
    title: text(ev.summary).trim() || "(No title)",
    location: text(ev.location).trim(),
    description: cleanDescription(text(ev.description)),
    allDay: fullDay,
    start: s,
    end: e,
    startDay,
    endDay,
  };
}

/** Parse ICS text into expanded events overlapping [from, to]. Pure; an empty calendar gives []. */
export function parseIcs(icsText: string, range: Range, tz: string): PlaylistEvent[] {
  const data = ical.parseICS(icsText);
  const out: PlaylistEvent[] = [];
  const from = new Date(range.from);
  const to = new Date(range.to);
  for (const item of Object.values(data)) {
    if (!item || item.type !== "VEVENT") continue;
    const ev = item as VEvent;
    if (!ev.start) continue;
    try {
      if (ev.rrule) {
        for (const inst of ical.expandRecurringEvent(ev, { from, to, expandOngoing: true })) {
          if (inst.event.status === "CANCELLED") continue;
          out.push(toEvent(ev.uid, inst.event, inst.start, inst.end, inst.isFullDay, tz));
        }
      } else {
        if (ev.status === "CANCELLED") continue;
        const fullDay = ev.datetype === "date" || ev.start.dateOnly === true;
        const e = toEvent(ev.uid, ev, ev.start, ev.end, fullDay, tz);
        if (e.end >= range.from && e.start <= range.to) out.push(e);
      }
    } catch (err) {
      console.warn(`[calendar] skipped an event that could not be expanded: ${(err as Error).message}`);
    }
  }
  const seen = new Set<string>();
  return out
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
}

/** Fetch and parse the public feed for the next `fetchDays` days. Throws on network failure. */
export async function fetchEvents(
  calendarId: string,
  fetchDays: number,
  tz: string,
  now = Date.now(),
): Promise<PlaylistEvent[]> {
  const res = await fetch(feedUrl(calendarId), {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching calendar feed`);
  const body = await res.text();
  if (!body.includes("BEGIN:VCALENDAR")) throw new Error("calendar feed is not iCalendar data");
  return parseIcs(body, { from: now - 24 * 3600_000, to: now + fetchDays * 24 * 3600_000 }, tz);
}
