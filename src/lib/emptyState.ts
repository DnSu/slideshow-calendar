import type { SourceStatuses } from "./types";

export type EmptyReason = {
  source: "Pictures" | "Events" | "Weather";
  text: string;
  hint?: string;
};

/** What the screen can show right now, worked out on the screen (dates, stale forecast…). */
export type ShowableNow = {
  activeImages: number;
  totalImages: number;
  hasEvents: boolean;
  hasWeather: boolean;
  /** Pictures are scheduled but none could be loaded (e.g. offline and not saved yet). */
  imagesFailed?: boolean;
};

/**
 * Friendly, per-source reasons for an empty screen. `sources` can be missing in a playlist
 * saved by an older version; then only what the screen itself can tell is reported.
 */
export function emptyReasons(
  sources: SourceStatuses | undefined,
  now: ShowableNow,
): EmptyReason[] {
  const out: EmptyReason[] = [];

  if (now.activeImages === 0 || now.imagesFailed) {
    const s = sources?.drive;
    if (now.imagesFailed)
      out.push({
        source: "Pictures",
        text: "The pictures couldn't be loaded.",
      });
    else if (s === "unconfigured")
      out.push({
        source: "Pictures",
        text: "No Google Drive folder is set up.",
        hint: "Set DRIVE_FOLDER_ID.",
      });
    else if (s === "error")
      out.push({
        source: "Pictures",
        text: "Couldn't reach the Google Drive folder.",
      });
    else if (now.totalImages > 0)
      out.push({
        source: "Pictures",
        text: "None of the pictures are scheduled for today.",
      });
    else
      out.push({
        source: "Pictures",
        text: "The Google Drive folder has no pictures yet.",
      });
  }

  if (!now.hasEvents) {
    const s = sources?.calendar;
    if (s === "unconfigured")
      out.push({
        source: "Events",
        text: "No Google Calendar is set up.",
        hint: "Set CALENDAR_ID.",
      });
    else if (s === "error")
      out.push({
        source: "Events",
        text: "Couldn't reach the Google Calendar.",
      });
    else out.push({ source: "Events", text: "There are no upcoming events." });
  }

  if (!now.hasWeather) {
    const s = sources?.weather;
    if (s === "unconfigured")
      out.push({
        source: "Weather",
        text: "No location is set up for the forecast.",
        hint: "Set WEATHER_ZIP.",
      });
    else if (s === "disabled")
      out.push({
        source: "Weather",
        text: "Weather is turned off in the settings.",
      });
    else if (s === "error")
      out.push({ source: "Weather", text: "Couldn't get the forecast." });
    else
      out.push({
        source: "Weather",
        text: "The saved forecast is out of date.",
      });
  }

  return out;
}
