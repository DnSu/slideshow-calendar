"use client";

import { useEffect, useState } from "react";
import { demoEvents } from "@/lib/demoEvents";
import { eventPages } from "@/lib/events";
import type { Playlist } from "@/lib/types";
import CalendarSlide from "./CalendarSlide";

type Props = { demo: boolean; pinnedPage: number | null };

/**
 * Developer preview of the calendar page (/calendar). Shows the live calendar exactly as the
 * player renders it, without the slideshow.
 *   ?demo      use made-up events instead of the live feed
 *   ?page=N    stay on page N (1-based) instead of rotating
 *   ← / →      step through pages
 */
export default function CalendarPreview({ demo, pinnedPage }: Props) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [page, setPage] = useState(pinnedPage ?? 0);

  useEffect(() => {
    fetch("/api/playlist", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: Playlist) => setPlaylist(data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));

    const tick = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const cfg = playlist?.config;
  const events = cfg ? (demo ? demoEvents(nowMs, cfg.timezone) : playlist.events) : [];
  const pageCount = cfg ? eventPages(events, nowMs, cfg.timezone, cfg.calendar).length : 0;

  // Rotate pages on the same timing as the player, unless a page is pinned.
  useEffect(() => {
    if (!cfg || pinnedPage !== null || pageCount < 2) return;
    const t = setInterval(() => setPage((p) => p + 1), cfg.calendar.displaySeconds * 1000);
    return () => clearInterval(t);
  }, [cfg, pinnedPage, pageCount]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!pageCount) return;
      if (e.key === "ArrowRight") setPage((p) => (p + 1) % pageCount);
      if (e.key === "ArrowLeft") setPage((p) => (p - 1 + pageCount) % pageCount);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageCount]);

  let notice: string | null = null;
  if (error) notice = `Could not load /api/playlist: ${error}`;
  else if (!cfg) notice = "Loading…";
  else if (pageCount === 0)
    notice = "No upcoming events. The main screen skips the calendar page. Add ?demo to preview with sample events.";

  return (
    <main className="player">
      {cfg && pageCount > 0 && (
        <CalendarSlide events={events} nowMs={nowMs} timezone={cfg.timezone} calendar={cfg.calendar} page={page} />
      )}
      {notice && <div className="preview-notice">{notice}</div>}
    </main>
  );
}
