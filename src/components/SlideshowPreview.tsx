"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { demoEvents } from "@/lib/demoEvents";
import { demoWeather } from "@/lib/demoWeather";
import { weatherView } from "@/lib/weatherView";
import { eventPages } from "@/lib/events";
import { imageUrl } from "@/lib/offline";
import { activeImages, previewCycle, type Step } from "@/lib/slides";
import type { Playlist, PlaylistImage } from "@/lib/types";
import CalendarSlide from "./CalendarSlide";
import WeatherSlide from "./WeatherSlide";

type Props = { demo: boolean };

/**
 * Developer preview of the slideshow (/slideshow) in a portrait 9:16 frame. Never advances on
 * its own: the buttons below the frame (or ← / →) step through a loop of every image once,
 * then each calendar page, then the weather (shorter than the player's real order).
 *   ?demo   use made-up calendar events instead of the live feed
 */
export default function SlideshowPreview({ demo }: Props) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetch("/api/playlist", { cache: "no-store" })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((data: Playlist) => setPlaylist(data))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
  }, []);

  const cfg = playlist?.config;
  const images = useMemo(
    () =>
      playlist && cfg ? activeImages(playlist.images, nowMs, cfg.timezone) : [],
    [playlist, cfg, nowMs],
  );
  const events = useMemo(
    () =>
      cfg
        ? demo
          ? demoEvents(nowMs, cfg.timezone)
          : (playlist?.events ?? [])
        : [],
    [cfg, demo, nowMs, playlist],
  );
  const pageCount = cfg
    ? eventPages(events, nowMs, cfg.timezone, cfg.calendar).length
    : 0;
  const weather = useMemo(
    () =>
      cfg
        ? demo
          ? demoWeather(nowMs, cfg.timezone, cfg.weather.units)
          : (playlist?.weather ?? null)
        : null,
    [cfg, demo, nowMs, playlist],
  );
  const hasWeather =
    !!cfg && (demo || cfg.weather.enabled) && weatherView(weather, nowMs, cfg.timezone) !== null;
  const byId = useMemo(() => new Map(images.map((i) => [i.id, i])), [images]);

  // Every image once, then each calendar page, then weather, then round again.
  const cycle = useMemo(
    () => previewCycle(images.map((i) => i.id), pageCount, hasWeather),
    [images, pageCount, hasWeather],
  );
  const total = cycle.length;
  const position = total ? index % total : 0;
  const step = cycle[position];
  const following = total ? cycle[(position + 1) % total] : undefined;

  const next = useCallback(() => setIndex((i) => i + 1), []);
  const prev = useCallback(() => setIndex((i) => (total ? ((i % total) - 1 + total) % total : 0)), [total]);
  const restart = useCallback(() => setIndex(0), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Preload the next image so stepping forward is instant.
  useEffect(() => {
    if (following?.slide.kind === "image")
      new Image().src = imageUrl(
        following.slide.id,
        byId.get(following.slide.id)?.version,
      );
  }, [following, byId]);

  let notice: string | null = null;
  if (error) notice = `Could not load /api/playlist: ${error}`;
  else if (!cfg) notice = "Loading…";
  else if (!step)
    notice =
      "Nothing to show: no active images, no upcoming events and no weather. The screen would be black.";

  return (
    <div className="preview-page">
      <div className="preview-frame">
        {cfg && step && (
          <div
            key={index}
            className="layer"
            style={{ animationDuration: `${cfg.slideshow.transitionMs}ms` }}
          >
            {step.slide.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl(step.slide.id, byId.get(step.slide.id)?.version)}
                alt=""
                style={{ objectFit: cfg.slideshow.imageFit }}
              />
            ) : step.slide.kind === "weather" ? (
              weather && (
                <WeatherSlide
                  weather={weather}
                  nowMs={nowMs}
                  timezone={cfg.timezone}
                  settings={cfg.weather}
                />
              )
            ) : (
              <CalendarSlide
                events={events}
                nowMs={nowMs}
                timezone={cfg.timezone}
                calendar={cfg.calendar}
                page={step.page}
              />
            )}
          </div>
        )}
        {notice && <div className="preview-notice">{notice}</div>}
      </div>

      <div className="preview-controls">
        <div className="preview-buttons">
          <button type="button" onClick={prev} disabled={!total}>
            ◀ Prev
          </button>
          <button type="button" onClick={next} disabled={!total}>
            Next ▶
          </button>
          <button type="button" onClick={restart} disabled={position === 0}>
            Restart
          </button>
        </div>
        <div className="preview-info">
          {step && cfg
            ? describe(
                step,
                position,
                total,
                byId,
                pageCount,
                cfg.slideshow.imageSeconds,
                cfg.calendar.displaySeconds,
                cfg.weather.displaySeconds,
              )
            : "—"}
        </div>
      </div>
    </div>
  );
}

function windowText(i: PlaylistImage): string {
  if (i.yearly) {
    return i.yearly.from === i.yearly.to
      ? `every year on ${i.yearly.from}`
      : `every year ${i.yearly.from} – ${i.yearly.to}`;
  }
  if (!i.start && !i.end) return "root, always";
  if (!i.start) return `until ${i.end}`;
  return `${i.start} – ${i.end}`;
}

/** `position` loops 0..total-1 over the preview cycle: images, calendar pages, weather. */
function describe(
  step: Step,
  position: number,
  total: number,
  byId: Map<string, PlaylistImage>,
  pageCount: number,
  imageSeconds: number,
  calendarSeconds: number,
  weatherSeconds: number,
): string {
  const n = `Slide ${position + 1} of ${total}`;
  if (step.slide.kind === "weather") return `${n} · Weather · ${weatherSeconds}s on screen`;
  if (step.slide.kind === "calendar") {
    return `${n} · Calendar page ${step.page + 1} of ${pageCount} · ${calendarSeconds}s on screen`;
  }
  const img = byId.get(step.slide.id);
  return `${n} · ${img ? windowText(img) : "image"} · ${imageSeconds}s on screen`;
}
