import { describe, expect, it } from "vitest";
import { mergePlaylist } from "@/lib/merge";
import { defaultSettings } from "@/lib/config";
import type { Playlist, PlaylistEvent } from "@/lib/types";

const ev = (
  id: string,
  start: string,
  end: string,
  extra: Partial<PlaylistEvent> = {},
): PlaylistEvent => ({
  id,
  title: id,
  location: "",
  description: "",
  allDay: false,
  start: Date.parse(start),
  end: Date.parse(end),
  startDay: start.slice(0, 10),
  endDay: end.slice(0, 10),
  ...extra,
});

describe("mergePlaylist", () => {
  const base = (over: Partial<Playlist>): Playlist => ({
    images: [],
    events: [],
    config: { ...defaultSettings, timezone: "UTC" },
    serverTime: 1000,
    degraded: [],
    sources: { drive: "ok", calendar: "ok", weather: "ok" },
    release: "dev",
    ...over,
  });
  const img = (id: string) => ({ id, name: id, start: null, end: null });
  it("keeps data for degraded sources and ignores older playlists", () => {
    const prev = base({
      images: [img("a")],
      events: [ev("e", "2026-03-10T15:00:00Z", "2026-03-10T16:00:00Z")],
    });
    const next = base({
      serverTime: 2000,
      degraded: ["drive"],
      images: [],
      events: [],
    });
    const m = mergePlaylist(prev, next);
    expect(m.images.map((i) => i.id)).toEqual(["a"]);
    expect(m.events).toEqual([]);
    expect(
      mergePlaylist(base({ serverTime: 3000 }), base({ serverTime: 2000 }))
        .serverTime,
    ).toBe(3000);
  });
  it("keeps the emergency state with the images when Drive is down, and drops it when cleared", () => {
    const prev = base({ images: [img("e")], emergency: true });
    const driveDown = mergePlaylist(
      prev,
      base({ serverTime: 2000, degraded: ["drive"] }),
    );
    expect(driveDown.emergency).toBe(true);
    expect(driveDown.images.map((i) => i.id)).toEqual(["e"]);
    const cleared = mergePlaylist(
      prev,
      base({ serverTime: 2000, images: [img("a")] }),
    );
    expect(cleared.emergency).toBeFalsy();
    expect(cleared.images.map((i) => i.id)).toEqual(["a"]);
  });
});
