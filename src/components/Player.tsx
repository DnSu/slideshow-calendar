"use client";

import { useEffect, useRef, useState } from "react";
import { mergePlaylist } from "@/lib/merge";
import {
  imageUrl,
  preloadImage,
  pruneImages,
  setupOffline,
  warmImages,
} from "@/lib/offline";
import { BUILT_RELEASE, shouldReloadForRelease } from "@/lib/release";
import { eventPages } from "@/lib/events";
import {
  activeImages,
  initialSeqState,
  nextSlide,
  slideDurationMs,
  trustedNow,
  type Slide,
} from "@/lib/slides";
import type { Playlist } from "@/lib/types";
import { weatherView } from "@/lib/weatherView";
import CalendarSlide from "./CalendarSlide";
import WeatherSlide from "./WeatherSlide";
import OfflineDot from "./OfflineDot";
import styles from "./Player.module.css";
import NothingToShow from "./NothingToShow";
import { emptyReasons, type EmptyReason } from "@/lib/emptyState";

/** `page` is the calendar page shown on this layer (images: 0). */
type Layer = { key: number; slide: Slide; page: number; src: string };

const MINUTE = 60_000;

export default function Player() {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [nowMs, setNowMs] = useState(0);
  const [offline, setOffline] = useState(false);
  // Why the screen is empty, when there's nothing to show (instead of a black screen).
  const [empty, setEmpty] = useState<EmptyReason[] | null>(null);
  const playlistRef = useRef<Playlist | null>(null);
  const failedRef = useRef(false);
  // Check the playlist now instead of at the next scheduled time (at most once a minute).
  const pollSoonRef = useRef<() => void>(() => {});
  // The version this page's code is. If the build didn't record one, the first live response sets it.
  const knownRelease = useRef<string | null>(
    BUILT_RELEASE !== "dev" ? BUILT_RELEASE : null,
  );

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    void setupOffline();
  }, []);

  // Fetch the playlist now and then. A failed fetch (or one answered from the saved copy)
  // keeps the playlist we already have.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let polling = false;
    let lastEarlyPoll = 0;
    // An image failed to load (likely moved or deleted in Drive): get the new list now.
    pollSoonRef.current = () => {
      const now = Date.now();
      if (cancelled || polling || now - lastEarlyPoll < MINUTE) return;
      lastEarlyPoll = now;
      clearTimeout(timer);
      void poll(true);
    };
    // Reload when a live response comes from a different deployment than this page's code.
    function checkRelease(incoming: string | undefined, fromCache: boolean) {
      if (fromCache || !incoming) return;
      if (knownRelease.current === null) {
        knownRelease.current = incoming;
        return;
      }
      const KEY = "reloadedForRelease";
      let tried: string | null = null;
      try {
        tried = sessionStorage.getItem(KEY);
      } catch {
        /* ignore */
      }
      if (
        shouldReloadForRelease(knownRelease.current, incoming, {
          online: navigator.onLine,
          fromCache,
          alreadyTried: tried === incoming,
        })
      ) {
        try {
          sessionStorage.setItem(KEY, incoming);
        } catch {
          /* without storage, the pageReloadHours reload is the fallback */
          return;
        }
        location.reload();
      }
    }
    // `fresh`: skip the CDN's short-lived copy of the playlist.
    async function poll(fresh = false) {
      polling = true;
      let ok = false;
      let minutes = 10;
      try {
        const url = fresh ? `/api/playlist?fresh=${Date.now()}` : "/api/playlist";
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as Playlist;
          const fromCache = res.headers.get("X-From-Cache") === "1";
          ok = !fromCache;
          if (ok && !cancelled) checkRelease(data.release, fromCache);
          minutes = data.config.refresh.playlistMinutes;
          if (!cancelled) setPlaylist((prev) => mergePlaylist(prev, data));
        }
      } catch {
        /* keep what we have */
      }
      polling = false;
      if (cancelled) return;
      failedRef.current = !ok;
      setOffline(!ok);
      timer = setTimeout(poll, ok ? minutes * MINUTE : MINUTE);
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Once a minute: refresh the clock (date windows, upcoming events) and reload every
  // pageReloadHours, but only while the last playlist fetch worked.
  useEffect(() => {
    const started = performance.now();
    const tick = () => {
      const pl = playlistRef.current;
      setNowMs(trustedNow(Date.now(), pl?.serverTime ?? 0));
      const hours = pl?.config.refresh.pageReloadHours ?? 6;
      if (
        pl &&
        !failedRef.current &&
        navigator.onLine &&
        performance.now() - started >= hours * 3600_000
      ) {
        location.reload();
      }
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, MINUTE);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  // Keep images saved for offline use; drop the ones that left the playlist.
  const imageKey =
    playlist?.images.map((i) => imageUrl(i.id, i.version)).join("\n") ?? null;
  useEffect(() => {
    if (imageKey === null) return;
    const urls = imageKey ? imageKey.split("\n") : [];
    let cancelled = false;
    pruneImages(urls);
    void warmImages(urls, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [imageKey]);

  // The slide loop.
  useEffect(() => {
    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(() => {
          timers.delete(t);
          resolve();
        }, ms);
        timers.add(t);
      });

    async function run() {
      let seq = initialSeqState;
      let layerKey = 0;
      let current: Slide | null = null;
      let currentPage = 0;
      let currentSrc = "";
      let calendarTurns = 0; // advances one calendar page per calendar turn
      while (!cancelled) {
        const pl = playlistRef.current;
        if (!pl) {
          await sleep(1000);
          continue;
        }
        const now = trustedNow(Date.now(), pl.serverTime);
        const tz = pl.config.timezone;
        const active = activeImages(pl.images, now, tz);
        const ids = active.map((i) => i.id);
        const versions = new Map(active.map((i) => [i.id, i.version]));
        const src = (id: string) => imageUrl(id, versions.get(id));
        const pageCount = eventPages(
          pl.events,
          now,
          tz,
          pl.config.calendar,
        ).length;
        // Emergency Override: only its images, no calendar or weather.
        const hasEvents = !pl.emergency && pageCount > 0;
        const hasWeather =
          !pl.emergency &&
          pl.config.weather.enabled &&
          weatherView(pl.weather, now, tz) !== null;
        const after = pl.config.calendar.showAfterImages;
        setNowMs(now);

        let slide: Slide | null = null;
        for (let tries = 0; tries <= ids.length; tries++) {
          const r = nextSlide(seq, ids, hasEvents, after, hasWeather);
          seq = r.state;
          slide = r.slide;
          if (slide?.kind !== "image") break;
          if (await preloadImage(src(slide.id))) break;
          if (cancelled) return;
          slide = null; // failed to load: skip it, and check whether the playlist changed
          pollSoonRef.current();
        }
        if (cancelled) return;
        if (!slide && hasEvents) slide = { kind: "calendar" };
        else if (!slide && hasWeather) slide = { kind: "weather" };

        if (!slide) {
          current = null;
          setLayers([]);
          setEmpty(
            emptyReasons(pl.sources, {
              activeImages: ids.length,
              totalImages: pl.images.length,
              hasEvents,
              hasWeather,
              imagesFailed: ids.length > 0,
            }),
          );
          await sleep(10_000);
          continue;
        }

        setEmpty(null);
        const page =
          slide.kind === "calendar" ? calendarTurns++ % pageCount : 0;
        const same =
          current !== null &&
          current.kind === slide.kind &&
          (slide.kind === "calendar"
            ? currentPage === page
            : slide.kind === "weather" ||
              (current.kind === "image" &&
                current.id === slide.id &&
                currentSrc === src(slide.id)));
        if (!same) {
          current = slide;
          currentPage = page;
          currentSrc = slide.kind === "image" ? src(slide.id) : "";
          const layer: Layer = {
            key: ++layerKey,
            slide,
            page,
            src: currentSrc,
          };
          setLayers((prev) => [...prev.slice(-1), layer]);
          const fade = pl.config.slideshow.transitionMs;
          const t = setTimeout(() => {
            timers.delete(t);
            setLayers((prev) => prev.filter((l) => l.key === layer.key));
          }, fade + 100);
          timers.add(t);
        }

        // Preload the image that will follow.
        const peek = nextSlide(seq, ids, hasEvents, after, hasWeather).slide;
        if (peek?.kind === "image") void preloadImage(src(peek.id));

        await sleep(slideDurationMs(slide, pl.config));
      }
    }
    void run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  const cfg = playlist?.config;
  return (
    <main className={styles.player}>
      {layers.map((l) => (
        <div
          key={l.key}
          className={styles.layer}
          style={{
            animationDuration: `${cfg?.slideshow.transitionMs ?? 1000}ms`,
          }}
        >
          {l.slide.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={l.src}
              alt=""
              style={{ objectFit: cfg?.slideshow.imageFit ?? "cover" }}
              onError={() => pollSoonRef.current()}
            />
          ) : l.slide.kind === "weather" ? (
            cfg &&
            playlist?.weather && (
              <WeatherSlide
                weather={playlist.weather}
                nowMs={nowMs}
                timezone={cfg.timezone}
                settings={cfg.weather}
              />
            )
          ) : (
            cfg &&
            playlist && (
              <CalendarSlide
                events={playlist.events}
                nowMs={nowMs}
                timezone={cfg.timezone}
                calendar={cfg.calendar}
                page={l.page}
              />
            )
          )}
        </div>
      ))}
      {empty && layers.length === 0 && cfg && (
        <NothingToShow
          reasons={empty}
          checkMinutes={cfg.refresh.playlistMinutes}
        />
      )}
      {!playlist && offline && <NothingToShow unreachable />}
      {offline && cfg?.offline.showIndicator && playlist && <OfflineDot />}
    </main>
  );
}
