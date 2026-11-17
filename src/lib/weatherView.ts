import { dayInTz } from "./dates";
import type { PlaylistWeather, WeatherCurrent, WeatherDay } from "./types";

/** Current conditions older than this are hidden. */
export const CURRENT_MAX_AGE_MS = 3 * 3_600_000;
const MAX_DAYS = 5;

export type WeatherView = {
  /** The first forecast day not in the past; "today" for the big block. */
  today: WeatherDay;
  /** Up to 4 following days. */
  next: WeatherDay[];
  /** Only set when `today` really is today and the data is under 3 hours old. */
  current: WeatherCurrent | null;
};

/**
 * What the screen shows right now. Days are picked by date on the screen's clock, so an offline
 * screen moves "today" forward by itself. Fewer than 2 days left gives null (slide skipped).
 */
export function weatherView(
  weather: PlaylistWeather | null | undefined,
  nowMs: number,
  tz: string,
): WeatherView | null {
  if (!weather) return null;
  const todayDay = dayInTz(nowMs, tz);
  const days = weather.days.filter((d) => d.day >= todayDay).slice(0, MAX_DAYS);
  if (days.length < 2) return null;
  const [today, ...next] = days;
  const fresh = nowMs - weather.fetchedAt <= CURRENT_MAX_AGE_MS && nowMs >= weather.fetchedAt - 60_000;
  return { today, next, current: today.day === todayDay && fresh ? weather.current : null };
}
