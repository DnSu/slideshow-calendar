"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { demoEvents } from "@/lib/demoEvents";
import { eventPages } from "@/lib/events";
import { imageUrl } from "@/lib/offline";
import { activeImages, sequence, type Step } from "@/lib/slides";
import type { Playlist, PlaylistImage } from "@/lib/types";
import CalendarSlide from "./CalendarSlide";

type Props = { demo: boolean };

/**
 * Developer preview of the slideshow (/slideshow) in a portrait 9:16 frame. Never advances on
 * its own: the buttons below the frame (or ← / →) step through the same order the player uses.
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
  // Active images, plus the calendar if it has events: the slide number loops 1..assetCount.
  const assetCount = images.length + (pageCount > 0 ? 1 : 0);
  const byId = useMemo(() => new Map(images.map((i) => [i.id, i])), [images]);

  // Replay the player's order up to one step past the current one (so we know if Next works).
  const steps = useMemo(
    () =>
      cfg
        ? sequence(
            index + 2,
            images.map((i) => i.id),
            pageCount,
            cfg.calendar.showAfterImages,
          )
        : [],
    [cfg, images, pageCount, index],
  );
  const step = steps[index];
  const following = steps[index + 1];

  const next = useCallback(() => {
    if (following) setIndex((i) => i + 1);
  }, [following]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
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
      new Image().src = imageUrl(following.slide.id);
  }, [following]);

  let notice: string | null = null;
  if (error) notice = `Could not load /api/playlist: ${error}`;
  else if (!cfg) notice = "Loading…";
  else if (!step)
    notice =
      "Nothing to show: no active images and no upcoming events. The screen would be black.";

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
                src={imageUrl(step.slide.id)}
                alt=""
                style={{ objectFit: cfg.slideshow.imageFit }}
              />
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
        <button type="button" onClick={prev} disabled={index === 0}>
          ◀ Prev
        </button>
        <div className="preview-info">
          {step && cfg
            ? describe(
                step,
                index % assetCount,
                assetCount,
                byId,
                pageCount,
                cfg.slideshow.imageSeconds,
                cfg.calendar.displaySeconds,
              )
            : "—"}
        </div>
        <button type="button" onClick={next} disabled={!following}>
          Next ▶
        </button>
        <button type="button" onClick={restart} disabled={index === 0}>
          Restart
        </button>
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

/** `position` loops 0..total-1, where total = active images, plus 1 for the calendar if it has events. */
function describe(
  step: Step,
  position: number,
  total: number,
  byId: Map<string, PlaylistImage>,
  pageCount: number,
  imageSeconds: number,
  calendarSeconds: number,
): string {
  const n = `Slide ${position + 1} of ${total}`;
  if (step.slide.kind === "calendar") {
    return `${n} · Calendar page ${step.page + 1} of ${pageCount} · ${calendarSeconds}s on screen`;
  }
  const img = byId.get(step.slide.id);
  return `${n} · ${img ? windowText(img) : "image"} · ${imageSeconds}s on screen`;
}
