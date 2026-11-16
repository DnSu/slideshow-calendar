"use client";

import { useEffect, useRef, useState } from "react";
import { mergePlaylist } from "@/lib/merge";
import { imageUrl, preloadImage, pruneImages, setupOffline, warmImages } from "@/lib/offline";
import { eventPages } from "@/lib/events";
import { activeImages, initialSeqState, nextSlide, slideDurationMs, trustedNow, type Slide } from "@/lib/slides";
import type { Playlist } from "@/lib/types";
import CalendarSlide from "./CalendarSlide";
import OfflineDot from "./OfflineDot";

/** `page` is the calendar page shown on this layer (images: 0). */
type Layer = { key: number; slide: Slide; page: number };

const MINUTE = 60_000;

export default function Player() {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [nowMs, setNowMs] = useState(0);
  const [offline, setOffline] = useState(false);
  const playlistRef = useRef<Playlist | null>(null);
  const failedRef = useRef(false);

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
    async function poll() {
      let ok = false;
      let minutes = 10;
      try {
        const res = await fetch("/api/playlist", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as Playlist;
          ok = res.headers.get("X-From-Cache") !== "1";
          minutes = data.config.refresh.playlistMinutes;
          if (!cancelled) setPlaylist((prev) => mergePlaylist(prev, data));
        }
      } catch {
        /* keep what we have */
      }
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
      if (pl && !failedRef.current && navigator.onLine && performance.now() - started >= hours * 3600_000) {
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
  const imageKey = playlist?.images.map((i) => i.id).join(",") ?? null;
  useEffect(() => {
    if (imageKey === null) return;
    const ids = imageKey ? imageKey.split(",") : [];
    let cancelled = false;
    pruneImages(ids);
    void warmImages(ids, () => cancelled);
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
      let calendarTurns = 0; // advances one calendar page per calendar turn
      while (!cancelled) {
        const pl = playlistRef.current;
        if (!pl) {
          await sleep(1000);
          continue;
        }
        const now = trustedNow(Date.now(), pl.serverTime);
        const tz = pl.config.timezone;
        const ids = activeImages(pl.images, now, tz).map((i) => i.id);
        const pageCount = eventPages(pl.events, now, tz, pl.config.calendar).length;
        const hasEvents = pageCount > 0;
        const after = pl.config.calendar.showAfterImages;
        setNowMs(now);

        let slide: Slide | null = null;
        for (let tries = 0; tries <= ids.length; tries++) {
          const r = nextSlide(seq, ids, hasEvents, after);
          seq = r.state;
          slide = r.slide;
          if (slide?.kind !== "image") break;
          if (await preloadImage(imageUrl(slide.id))) break;
          if (cancelled) return;
          slide = null; // failed to load: skip it
        }
        if (cancelled) return;
        if (!slide && hasEvents) slide = { kind: "calendar" };

        if (!slide) {
          current = null;
          setLayers([]);
          await sleep(10_000);
          continue;
        }

        const page = slide.kind === "calendar" ? calendarTurns++ % pageCount : 0;
        const same =
          current !== null &&
          current.kind === slide.kind &&
          (slide.kind === "calendar"
            ? currentPage === page
            : current.kind === "image" && current.id === slide.id);
        if (!same) {
          current = slide;
          currentPage = page;
          const layer: Layer = { key: ++layerKey, slide, page };
          setLayers((prev) => [...prev.slice(-1), layer]);
          const fade = pl.config.slideshow.transitionMs;
          const t = setTimeout(() => {
            timers.delete(t);
            setLayers((prev) => prev.filter((l) => l.key === layer.key));
          }, fade + 100);
          timers.add(t);
        }

        // Preload the image that will follow.
        const peek = nextSlide(seq, ids, hasEvents, after).slide;
        if (peek?.kind === "image") void preloadImage(imageUrl(peek.id));

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
    <main className="player">
      {layers.map((l) => (
        <div
          key={l.key}
          className="layer"
          style={{ animationDuration: `${cfg?.slideshow.transitionMs ?? 1000}ms` }}
        >
          {l.slide.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl(l.slide.id)}
              alt=""
              style={{ objectFit: cfg?.slideshow.imageFit ?? "cover" }}
            />
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
      {offline && cfg?.offline.showIndicator && playlist && <OfflineDot />}
    </main>
  );
}
