import type { Settings } from "./config";
import type { Day } from "./dates";

export type PlaylistImage = {
  id: string;
  name: string;
  /** Inclusive date window in the configured timezone; null = unbounded. */
  start: Day | null;
  end: Day | null;
  /** Repeats every year ("MM-DD" bounds); set for "0000-…" folders. */
  yearly?: { from: string; to: string };
  /** Changes when the file is replaced in Drive; part of the image URL so caches refresh. */
  version?: string;
};

export type PlaylistEvent = {
  id: string;
  title: string;
  location: string;
  description: string;
  allDay: boolean;
  /** Instants (ms). For all-day events: start of first day, start of the day after the last. */
  start: number;
  end: number;
  /** First and last (inclusive) day in the configured timezone. */
  startDay: Day;
  endDay: Day;
};

export type WeatherUnits = "fahrenheit" | "celsius";

export type WeatherDay = {
  day: Day;
  /** WMO weather code. */
  code: number;
  high: number;
  low: number;
  /** Chance of precipitation, percent; null when the forecast has none. */
  rain: number | null;
};

export type WeatherCurrent = {
  temp: number;
  feelsLike: number | null;
  code: number;
  isDay: boolean;
  /** mph (fahrenheit) or km/h (celsius). */
  wind: number | null;
  humidity: number | null;
};

/** A forecast in the units of `units`. Contains no location. */
export type PlaylistWeather = {
  /** When the server fetched it (ms). */
  fetchedAt: number;
  units: WeatherUnits;
  current: WeatherCurrent | null;
  days: WeatherDay[];
};

export type Playlist = {
  images: PlaylistImage[];
  events: PlaylistEvent[];
  config: Settings;
  /** Forecast, or null/absent when weather is off, unconfigured or has never loaded. */
  weather?: PlaylistWeather | null;
  /** Server clock when this response was produced (ms). Used as a floor for the screen's clock. */
  serverTime: number;
  /** Deployment ID of the server that produced this response ("dev" locally). Never cached. */
  release: string;
  /** Which sources failed with no earlier good copy, so the screen should keep what it has. */
  degraded: ("drive" | "calendar" | "weather")[];
  /**
   * True while the Drive "Emergency Override" folder has images: `images` is then only those,
   * and screens skip the calendar and weather until the images are removed.
   */
  emergency?: boolean;
  /** Why each source has (or hasn't) got content, so an empty screen can say why. */
  sources: SourceStatuses;
};

/**
 * ok: has content. empty: works but has nothing (no images, no upcoming events).
 * unconfigured: its env var isn't set. disabled: turned off in settings. error: couldn't be read.
 */
export type SourceStatus =
  "ok" | "empty" | "unconfigured" | "disabled" | "error";
export type SourceStatuses = {
  drive: SourceStatus;
  calendar: SourceStatus;
  weather: SourceStatus;
};
