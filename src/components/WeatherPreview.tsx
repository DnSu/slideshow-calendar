"use client";

import { useCallback, useEffect, useState } from "react";
import { DEMO_WEATHER_VARIANTS, demoWeather } from "@/lib/demoWeather";
import type { Playlist } from "@/lib/types";
import { weatherView } from "@/lib/weatherView";
import WeatherSlide from "./WeatherSlide";
import { NextIcon, PrevIcon, RefreshIcon } from "./PreviewIcons";
import styles from "./Preview.module.css";

type Props = { demo: boolean };

/**
 * Developer preview of the weather slide (/weather) in the same portrait 9:16 frame as /calendar.
 *   ?demo         made-up forecast instead of the live one; ‹ / › switch between sets of icons
 *   ⟳             fetches the playlist (and so the forecast) again
 */
export default function WeatherPreview({ demo }: Props) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [variant, setVariant] = useState(0);

  const load = useCallback(() => {
    fetch("/api/playlist", { cache: "no-store" })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      )
      .then((data: Playlist) => {
        setPlaylist(data);
        setError(null);
        setNowMs(Date.now());
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
  }, []);

  useEffect(() => {
    load();
    const tick = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, [load]);

  const cfg = playlist?.config;
  const weather = cfg
    ? demo
      ? demoWeather(nowMs, cfg.timezone, cfg.weather.units, variant)
      : (playlist.weather ?? null)
    : null;
  const shown =
    cfg &&
    weather &&
    (demo || cfg.weather.enabled) &&
    weatherView(weather, nowMs, cfg.timezone) !== null;

  const step = useCallback(
    (n: number) =>
      setVariant(
        (v) => (v + n + DEMO_WEATHER_VARIANTS) % DEMO_WEATHER_VARIANTS,
      ),
    [],
  );
  useEffect(() => {
    if (!demo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [demo, step]);

  let notice: string | null = null;
  if (error) notice = `Could not load /api/playlist: ${error}`;
  else if (!cfg) notice = "Loading…";
  else if (!shown)
    notice =
      "No weather to show. The main screen skips the weather slide. Turn on sample data in the menu to preview the layout.";

  let info = "—";
  if (cfg) {
    if (shown && weather) {
      const updated = new Intl.DateTimeFormat("en-US", {
        timeZone: cfg.timezone,
        hour: "numeric",
        minute: "2-digit",
      }).format(weather.fetchedAt);
      info = `Weather · ${cfg.weather.displaySeconds}s on screen · updated ${updated}`;
      if (demo) info += ` · sample ${variant + 1} of ${DEMO_WEATHER_VARIANTS}`;
    } else if (!cfg.weather.enabled)
      info = "Weather is turned off (weather.enabled)";
    else if (playlist.degraded.includes("weather"))
      info = "Hidden: the forecast could not be loaded";
    else if (!weather)
      info = "Hidden: no weather location set (or weather is unavailable)";
    else info = "Hidden: fewer than 2 forecast days left";
  }

  return (
    <div className={styles.previewPage}>
      <div className={styles.previewFrame}>
        {cfg && weather && shown && (
          <WeatherSlide
            weather={weather}
            nowMs={nowMs}
            timezone={cfg.timezone}
            settings={cfg.weather}
          />
        )}
        {notice && <div className={styles.previewNotice}>{notice}</div>}
      </div>

      <div className={styles.previewControls}>
        <div className={styles.previewButtons}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => step(-1)}
            disabled={!demo}
            aria-label="Previous sample"
            title="Previous sample (←)"
          >
            <PrevIcon />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => step(1)}
            disabled={!demo}
            aria-label="Next sample"
            title="Next sample (→)"
          >
            <NextIcon />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={load}
            aria-label="Reload"
            title="Load the forecast again"
          >
            <RefreshIcon />
          </button>
        </div>
        <div className={styles.previewInfo}>{info}</div>
      </div>
    </div>
  );
}
