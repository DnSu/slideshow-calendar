import type { Settings } from "./config";
import type { Day } from "./dates";

export type PlaylistImage = {
  id: string;
  name: string;
  /** Inclusive date window in the configured timezone; null = unbounded. */
  start: Day | null;
  end: Day | null;
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

export type Playlist = {
  images: PlaylistImage[];
  events: PlaylistEvent[];
  config: Settings;
  /** Server clock when this response was produced (ms). Used as a floor for the screen's clock. */
  serverTime: number;
  /** Which sources failed with no earlier good copy, so the screen should keep what it has. */
  degraded: ("drive" | "calendar")[];
};
