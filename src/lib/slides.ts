import type { CoreSettings } from "./config";
import { dayInTz } from "./dates";
import { isActiveOnDay } from "./folderDates";
import type { PlaylistImage } from "./types";

export type Slide = { kind: "image"; id: string } | { kind: "calendar" };
export type SeqState = { cursor: number; shown: number };
export const initialSeqState: SeqState = { cursor: 0, shown: 0 };

/** Images whose folder date window includes today (in `tz`) at `nowMs`. */
export function activeImages(images: PlaylistImage[], nowMs: number, tz: string): PlaylistImage[] {
  const today = dayInTz(nowMs, tz);
  return images.filter((i) => isActiveOnDay(i, today));
}

/**
 * Decide the next slide. Pure: returns the slide and the next state.
 * - Images play in order; after `showAfterImages` images the calendar plays once.
 * - No upcoming events: the calendar is skipped.
 * - No images but events: the calendar stays. Neither: null (black screen).
 */
export function nextSlide(
  state: SeqState,
  imageIds: string[],
  hasEvents: boolean,
  showAfterImages: number,
): { slide: Slide | null; state: SeqState } {
  if (imageIds.length === 0) {
    return hasEvents
      ? { slide: { kind: "calendar" }, state: { cursor: state.cursor, shown: 0 } }
      : { slide: null, state };
  }
  if (hasEvents && state.shown >= showAfterImages) {
    return { slide: { kind: "calendar" }, state: { cursor: state.cursor, shown: 0 } };
  }
  const id = imageIds[state.cursor % imageIds.length];
  return {
    slide: { kind: "image", id },
    state: { cursor: (state.cursor % imageIds.length) + 1, shown: state.shown + 1 },
  };
}

export function slideDurationMs(slide: Slide, s: CoreSettings): number {
  return (slide.kind === "image" ? s.slideshow.imageSeconds : s.calendar.displaySeconds) * 1000;
}

/** Never trust a clock earlier than the last successful server contact. */
export function trustedNow(rawNowMs: number, lastServerTimeMs: number): number {
  return Math.max(rawNowMs, lastServerTimeMs);
}

/** A slide plus, for calendar slides, which calendar page it shows. */
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
): Step[] {
  const out: Step[] = [];
  let state = initialSeqState;
  let calendarTurns = 0;
  while (out.length < count) {
    const r = nextSlide(state, imageIds, pageCount > 0, showAfterImages);
    if (!r.slide) break;
    state = r.state;
    out.push({ slide: r.slide, page: r.slide.kind === "calendar" ? calendarTurns++ % pageCount : 0 });
  }
  return out;
}
