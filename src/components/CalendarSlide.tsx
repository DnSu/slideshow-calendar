import type { CoreSettings } from "@/lib/config";
import { addDays, dayInTz } from "@/lib/dates";
import { eventPages } from "@/lib/events";
import type { PlaylistEvent } from "@/lib/types";

type Props = {
  events: PlaylistEvent[];
  nowMs: number;
  timezone: string;
  calendar: CoreSettings["calendar"];
  /** Which page to show; wraps around if the number of pages has shrunk. */
  page: number;
};

function dayLabel(day: string, today: string) {
  const [y, m, d] = day.split("-").map(Number);
  const text = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
  if (day === today) return `Today, ${text}`;
  if (day === addDays(today, 1)) return `Tomorrow, ${text}`;
  return text;
}

function timeLabel(e: PlaylistEvent, tz: string) {
  if (e.allDay) return "All day";
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  return f.format(new Date(e.start));
}

export default function CalendarSlide({ events, nowMs, timezone, calendar, page }: Props) {
  const pages = eventPages(events, nowMs, timezone, calendar);
  const index = pages.length ? page % pages.length : 0;
  const groups = pages[index] ?? [];
  const today = dayInTz(nowMs, timezone);
  return (
    <div className="calendar">
      <header className="calendar-header">
        <h1>{calendar.title}</h1>
        {pages.length > 1 && (
          <div className="calendar-page">
            Page {index + 1} of {pages.length}
          </div>
        )}
      </header>
      <div className="calendar-days">
        {groups.map((g) => (
          <section key={g.day} className="calendar-day">
            <h2>{dayLabel(g.day, today)}</h2>
            <ul>
              {g.events.map((e) => (
                <li key={e.id}>
                  <div className="event-time">{timeLabel(e, timezone)}</div>
                  <div className="event-body">
                    <div className="event-title">{e.title}</div>
                    {e.location && <div className="event-location">{e.location}</div>}
                    {e.description && <div className="event-description">{e.description}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
