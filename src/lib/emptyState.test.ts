import { describe, expect, it } from "vitest";
import { emptyReasons } from "@/lib/emptyState";
import type { SourceStatuses } from "@/lib/types";

const nothing = {
  activeImages: 0,
  totalImages: 0,
  hasEvents: false,
  hasWeather: false,
};
const all = (s: SourceStatuses["drive"]): SourceStatuses => ({
  drive: s,
  calendar: s,
  weather: s,
});

describe("emptyReasons", () => {
  it("explains unconfigured sources with a setup hint", () => {
    const r = emptyReasons(all("unconfigured"), nothing);
    expect(r.map((x) => [x.source, x.hint])).toEqual([
      ["Pictures", "Set DRIVE_FOLDER_ID."],
      ["Events", "Set CALENDAR_ID."],
      ["Weather", "Set WEATHER_ZIP."],
    ]);
  });
  it("explains sources that couldn't be read", () => {
    expect(emptyReasons(all("error"), nothing).map((x) => x.text)).toEqual([
      "Couldn't reach the Google Drive folder.",
      "Couldn't reach the Google Calendar.",
      "Couldn't get the forecast.",
    ]);
  });
  it("explains working but empty sources", () => {
    const r = emptyReasons(
      { drive: "empty", calendar: "empty", weather: "disabled" },
      nothing,
    );
    expect(r.map((x) => x.text)).toEqual([
      "The Google Drive folder has no pictures yet.",
      "There are no upcoming events.",
      "Weather is turned off in the settings.",
    ]);
  });
  it("tells apart 'no pictures' from 'none scheduled today' and a stale forecast", () => {
    const r = emptyReasons(all("ok"), { ...nothing, totalImages: 3 });
    expect(r.map((x) => x.text)).toEqual([
      "None of the pictures are scheduled for today.",
      "There are no upcoming events.",
      "The saved forecast is out of date.",
    ]);
  });
  it("only lists sources that have nothing", () => {
    const r = emptyReasons(all("ok"), {
      activeImages: 2,
      totalImages: 2,
      hasEvents: true,
      hasWeather: false,
    });
    expect(r.map((x) => x.source)).toEqual(["Weather"]);
  });
  it("says when scheduled pictures couldn't be loaded", () => {
    const r = emptyReasons(all("ok"), {
      ...nothing,
      activeImages: 2,
      totalImages: 2,
      imagesFailed: true,
    });
    expect(r[0].text).toBe("The pictures couldn't be loaded.");
  });
  it("copes with a playlist from an older version (no statuses)", () => {
    expect(emptyReasons(undefined, nothing)).toHaveLength(3);
  });
});
