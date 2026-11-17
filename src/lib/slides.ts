import type { CoreSettings } from "./config";
import { dayInTz } from "./dates";
import { isActiveOnDay } from "./folderDates";
import type { PlaylistImage } from "./types";

export type Slide = { kind: "image"; id: string } | { kind: "calendar" } | { kind: "weather" };
/** `weatherDue`: the calendar just played, so weather follows it (same info turn). */
export type SeqState = { cursor: number; shown: number; weatherDue?: boolean };
export const initialSeqState: SeqState = { cursor: 0, shown: 0 };

/** Images whose folder date window includes today (in `tz`) at `nowMs`. */
export function activeImages(images: PlaylistImage[], nowMs: number, tz: string): PlaylistImage[] {
  const today = dayInTz(nowMs, tz);
  return images.filter((i) => isActiveOnDay(i, today));
}

/**
 * Decide the next slide. Pure: returns the slide and the next state.
 * - Images play in order; after `showAfterImages` images the "info turn" plays: the calendar,
 *   then (right after it) the weather.
 * - No upcoming events: the calendar is skipped (weather alone). No weather: it is skipped.
 * - No images but info: the info turn repeats. Nothing at all: null (black screen).
 */
export function nextSlide(
  state: SeqState,
  imageIds: string[],
  hasEvents: boolean,
  showAfterImages: number,
  hasWeather = false,
): { slide: Slide | null; state: SeqState } {
  if (state.weatherDue && hasWeather) {
    return { slide: { kind: "weather" }, state: { cursor: state.cursor, shown: 0 } };
  }
  const infoTurn = (): { slide: Slide; state: SeqState } =>
    hasEvents
      ? {
          slide: { kind: "calendar" },
          state: { cursor: state.cursor, shown: 0, ...(hasWeather ? { weatherDue: true } : {}) },
        }
      : { slide: { kind: "weather" }, state: { cursor: state.cursor, shown: 0 } };
  const hasInfo = hasEvents || hasWeather;
  if (imageIds.length === 0) return hasInfo ? infoTurn() : { slide: null, state };
  if (hasInfo && state.shown >= showAfterImages) return infoTurn();
  const id = imageIds[state.cursor % imageIds.length];
  return {
    slide: { kind: "image", id },
    state: { cursor: (state.cursor % imageIds.length) + 1, shown: state.shown + 1 },
  };
}

export function slideDurationMs(slide: Slide, s: CoreSettings): number {
  const seconds =
    slide.kind === "image"
      ? s.slideshow.imageSeconds
      : slide.kind === "weather"
        ? s.weather.displaySeconds
        : s.calendar.displaySeconds;
  return seconds * 1000;
}

/** Never trust a clock earlier than the last successful server contact. */
export function trustedNow(rawNowMs: number, lastServerTimeMs: number): number {
  return Math.max(rawNowMs, lastServerTimeMs);
}

/** A slide plus, for calendar slides, which calendar page it shows (otherwise 0). */
export type Step = { slide: Slide; page: number };

/**
 * The first `count` steps the player would show, from the start. Calendar turns rotate through
 * `pageCount` pages. Returns fewer steps (possibly none) when there is nothing to show.
 */
export function sequence(
  count: number,
  imageIds: string[],
  pageCount: number,
  showAfterImages: number,
  hasWeather = false,
): Step[] {
  const out: Step[] = [];
  let state = initialSeqState;
  let calendarTurns = 0;
  while (out.length < count) {
    const r = nextSlide(state, imageIds, pageCount > 0, showAfterImages, hasWeather);
    if (!r.slide) break;
    state = r.state;
    out.push({ slide: r.slide, page: r.slide.kind === "calendar" ? calendarTurns++ % pageCount : 0 });
  }
  return out;
}

/**
 * The /slideshow preview's loop (not the player's order): every image once, then each calendar
 * page once (if there are events), then the weather (if there is a forecast), then it starts over.
 */
export function previewCycle(imageIds: string[], pageCount: number, hasWeather: boolean): Step[] {
  return [
    ...imageIds.map((id): Step => ({ slide: { kind: "image", id }, page: 0 })),
    ...Array.from({ length: Math.max(0, pageCount) }, (_, page): Step => ({ slide: { kind: "calendar" }, page })),
    ...(hasWeather ? [{ slide: { kind: "weather" } as Slide, page: 0 }] : []),
  ];
}
