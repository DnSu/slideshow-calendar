"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoEvents } from "@/lib/demoEvents";
import { demoWeather } from "@/lib/demoWeather";
import { weatherView } from "@/lib/weatherView";
import { windowLabel } from "@/lib/windowLabels";
import { eventPages } from "@/lib/events";
import { imageUrl } from "@/lib/offline";
import { activeImages, previewCycle, type Step } from "@/lib/slides";
import type { Playlist, PlaylistImage } from "@/lib/types";
import CalendarSlide from "./CalendarSlide";
import WeatherSlide from "./WeatherSlide";
import styles from "./Preview.module.css";
import NothingToShow from "./NothingToShow";
import { emptyReasons } from "@/lib/emptyState";
import layerStyles from "./Player.module.css";

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
  const [refreshing, setRefreshing] = useState(false);
  // Off: only images on screen right now. On: also every-year images outside their dates and
  // images whose dates haven't started (the playlist already leaves out ended folders).
  const [showAll, setShowAll] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  // Images that failed to load and made us reload the list once (so a still-broken one can't loop).
  const reloadedFor = useRef(new Set<string>());

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

  // A picture failed to load (probably moved or deleted in Drive): load the list again, which
  // leaves it out once the server sees the change. /api/image already asked it to re-read Drive.
  const onImageError = useCallback(async (id: string) => {
    if (reloadedFor.current.has(id)) {
      setRefreshNote("This picture can't be loaded from Drive");
      return;
    }
    reloadedFor.current.add(id);
    setRefreshNote("A picture couldn't be loaded; reloading the list…");
    try {
      const p = await fetch(`/api/playlist?fresh=${Date.now()}`, { cache: "no-store" });
      if (!p.ok) throw new Error(`HTTP ${p.status}`);
      const data = (await p.json()) as Playlist;
      setPlaylist(data);
      setRefreshNote(
        data.images.some((i) => i.id === id)
          ? "This picture can't be loaded from Drive"
          : "A picture was moved or deleted in Drive; the list is updated",
      );
    } catch (e) {
      setRefreshNote(`Reload failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  // Refresh: have the server re-read Drive now, then load the new playlist. The query string
  // skips the CDN's short-lived copy of /api/playlist.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshNote(null);
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      if (r.status === 429) {
        const { retryAfterSeconds } = (await r.json()) as {
          retryAfterSeconds: number;
        };
        setRefreshNote(`Just refreshed; try again in ${retryAfterSeconds}s`);
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const p = await fetch(`/api/playlist?fresh=${Date.now()}`, {
        cache: "no-store",
      });
      if (!p.ok) throw new Error(`HTTP ${p.status}`);
      const data = (await p.json()) as Playlist;
      setPlaylist(data);
      setError(null);
      setRefreshNote(
        data.degraded.includes("drive")
          ? "Couldn't reach Drive; showing the last saved images"
          : `Refreshed from Drive, calendar and weather at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      );
    } catch (e) {
      setRefreshNote(
        `Refresh failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  const cfg = playlist?.config;
  const activeIds = useMemo(
    () =>
      new Set(
        playlist && cfg
          ? activeImages(playlist.images, nowMs, cfg.timezone).map((i) => i.id)
          : [],
      ),
    [playlist, cfg, nowMs],
  );
  const images = useMemo(
    () =>
      playlist
        ? showAll
          ? playlist.images
          : playlist.images.filter((i) => activeIds.has(i.id))
        : [],
    [playlist, showAll, activeIds],
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
  const emergency = !!playlist?.emergency;
  const pageCount =
    cfg && !emergency
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
    !!cfg &&
    !emergency &&
    (demo || cfg.weather.enabled) &&
    weatherView(weather, nowMs, cfg.timezone) !== null;
  const byId = useMemo(() => new Map(images.map((i) => [i.id, i])), [images]);

  // Every image once, then each calendar page, then weather, then round again.
  const cycle = useMemo(
    () =>
      previewCycle(
        images.map((i) => i.id),
        pageCount,
        hasWeather,
      ),
    [images, pageCount, hasWeather],
  );
  const total = cycle.length;
  const position = total ? index % total : 0;
  const step = cycle[position];
  const following = total ? cycle[(position + 1) % total] : undefined;

  const next = useCallback(() => {
    setRefreshNote(null);
    setIndex((i) => i + 1);
  }, []);
  const prev = useCallback(() => {
    setRefreshNote(null);
    setIndex((i) => (total ? ((i % total) - 1 + total) % total : 0));
  }, [total]);
  const restart = useCallback(() => {
    setRefreshNote(null);
    setIndex(0);
  }, []);

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

  return (
    <div className={styles.previewPage}>
      <div className={styles.previewFrame}>
        {cfg && step && (
          <div
            key={index}
            className={layerStyles.layer}
            style={{ animationDuration: `${cfg.slideshow.transitionMs}ms` }}
          >
            {step.slide.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl(step.slide.id, byId.get(step.slide.id)?.version)}
                alt=""
                onError={() => step.slide.kind === "image" && void onImageError(step.slide.id)}
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
        {cfg && !step && !error && playlist && (
          // Exactly what the screen shows when it has nothing.
          <NothingToShow
            reasons={emptyReasons(playlist.sources, {
              activeImages: activeIds.size,
              totalImages: playlist.images.length,
              hasEvents: pageCount > 0,
              hasWeather,
            })}
            checkMinutes={cfg.refresh.playlistMinutes}
          />
        )}
        {notice && <div className={styles.previewNotice}>{notice}</div>}
      </div>

      <div className={styles.previewControls}>
        <div className={styles.previewButtons}>
          <button type="button" onClick={prev} disabled={!total}>
            ◀ Prev
          </button>
          <button type="button" onClick={next} disabled={!total}>
            Next ▶
          </button>
          <button type="button" onClick={restart} disabled={position === 0}>
            Restart
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            title="Re-read Drive, the calendar and the weather now; screens get it at their next check (within 10 minutes)"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            className={showAll ? styles.active : undefined}
            aria-pressed={showAll}
            onClick={() => {
              setShowAll((v) => !v);
              setIndex(0);
              setRefreshNote(null);
            }}
            title="Also show every-year images outside their dates and images whose dates haven't started"
          >
            {showAll ? "All images" : "Active now"}
          </button>
        </div>
        <div className={styles.previewInfo}>
          {emergency && !refreshNote && (
            <strong className={styles.previewEmergency}>
              Emergency Override active ·{" "}
            </strong>
          )}
          {refreshNote ??
            (step && cfg
              ? describe(
                  step,
                  position,
                  total,
                  byId,
                  activeIds,
                  pageCount,
                  cfg.slideshow.imageSeconds,
                  cfg.calendar.displaySeconds,
                  cfg.weather.displaySeconds,
                )
              : "—")}
        </div>
      </div>
    </div>
  );
}

/** `position` loops 0..total-1 over the preview cycle: images, calendar pages, weather. */
function describe(
  step: Step,
  position: number,
  total: number,
  byId: Map<string, PlaylistImage>,
  activeIds: Set<string>,
  pageCount: number,
  imageSeconds: number,
  calendarSeconds: number,
  weatherSeconds: number,
): string {
  const n = `Slide ${position + 1} of ${total}`;
  if (step.slide.kind === "weather")
    return `${n} · Weather · ${weatherSeconds}s on screen`;
  if (step.slide.kind === "calendar") {
    return `${n} · Calendar page ${step.page + 1} of ${pageCount} · ${calendarSeconds}s on screen`;
  }
  const img = byId.get(step.slide.id);
  const shown = activeIds.has(step.slide.id)
    ? `${imageSeconds}s on screen`
    : "not on screen now";
  return `${n} · ${img ? windowLabel(img) : "image"} · ${shown}`;
}
