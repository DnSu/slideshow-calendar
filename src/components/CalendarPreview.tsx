"use client";

import { useCallback, useEffect, useState } from "react";
import { demoEvents } from "@/lib/demoEvents";
import { eventPages } from "@/lib/events";
import type { Playlist } from "@/lib/types";
import CalendarSlide from "./CalendarSlide";

type Props = { demo: boolean; pinnedPage: number | null };

/**
 * Developer preview of the calendar (/calendar) in the same portrait 9:16 frame as /slideshow.
 * Pages rotate on the player's `displaySeconds` timing until paused.
 *   ?demo      use made-up events instead of the live feed
 *   ?page=N    start paused on page N (1-based)
 *   ← / →      step through pages
 */
export default function CalendarPreview({ demo, pinnedPage }: Props) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [page, setPage] = useState(pinnedPage ?? 0);
  const [paused, setPaused] = useState(pinnedPage !== null);

  useEffect(() => {
    fetch("/api/playlist", { cache: "no-store" })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((data: Playlist) => setPlaylist(data))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      );

    const tick = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const cfg = playlist?.config;
  const events = cfg
    ? demo
      ? demoEvents(nowMs, cfg.timezone)
      : playlist.events
    : [];
  const pageCount = cfg
    ? eventPages(events, nowMs, cfg.timezone, cfg.calendar).length
    : 0;
  const index = pageCount ? page % pageCount : 0;

  const next = useCallback(() => setPage((p) => p + 1), []);
  const prev = useCallback(
    () =>
      setPage((p) =>
        pageCount ? ((p % pageCount) - 1 + pageCount) % pageCount : 0,
      ),
    [pageCount],
  );

  // Rotate pages on the same timing as the player, unless paused.
  useEffect(() => {
    if (!cfg || paused || pageCount < 2) return;
    const t = setInterval(next, cfg.calendar.displaySeconds * 1000);
    return () => clearInterval(t);
  }, [cfg, paused, pageCount, next, page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  let notice: string | null = null;
  if (error) notice = `Could not load /api/playlist: ${error}`;
  else if (!cfg) notice = "Loading…";
  else if (pageCount === 0)
    notice =
      "No upcoming events. The main screen skips the calendar page. Turn on sample events in the menu to preview the layout.";

  const multi = pageCount > 1;
  let info = "—";
  if (cfg && pageCount > 0) {
    info = `Page ${index + 1} of ${pageCount} · ${cfg.calendar.displaySeconds}s on screen`;
    if (multi) info += paused ? " · paused" : " · rotating";
  }

  return (
    <div className="preview-page">
      <div className="preview-frame">
        {cfg && pageCount > 0 && (
          <CalendarSlide
            events={events}
            nowMs={nowMs}
            timezone={cfg.timezone}
            calendar={cfg.calendar}
            page={index}
          />
        )}
        {notice && <div className="preview-notice">{notice}</div>}
      </div>

      <div className="preview-controls">
        <div className="preview-buttons">
          <button type="button" onClick={prev} disabled={!multi}>
            ◀ Prev
          </button>
          <button type="button" onClick={next} disabled={!multi}>
            Next ▶
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            disabled={!multi}
          >
            {paused ? "Play" : "Pause"}
          </button>
        </div>
        <div className="preview-info">{info}</div>
      </div>
    </div>
  );
}
