# 02 weather slide — done

Built:
- Weather slide right after calendar each info turn (alone if no events; skipped if no usable forecast). 15 s. Today ~55% (icon, temp, condition, 2 gray detail lines: feels/H/L, rain·wind), 4 compact day rows, 1-line footer credit.
- `/weather` preview tab (same frame/controls); demo = 4 sample forecasts.
- `/slideshow` preview loop: each active img once → calendar pages → weather (`previewCycle`); real player order unchanged.

Decisions:
- Open-Meteo forecast (no key; free non-commercial only; CC BY 4.0 → credit). NWS = fallback if commercial.
- Location env only, never to browser: `WEATHER_LATITUDE`+`WEATHER_LONGITUDE` win, else `WEATHER_ZIP` (+`WEATHER_COUNTRY`=US) geocoded via Open-Meteo, cached 30 d (`location` cacheLife).
- Settings `weather.{enabled,units(fahrenheit),displaySeconds(15),title}`, Drive-overridable.
- Same 60-min cache/last-good as other sources; failure → no weather + `degraded` "weather".
- Offline: days chosen by date on screen; <2 days left → skip; current hidden if >3 h old.
- Icons: Meteocons monochrome (MIT) vendored in `src/components/weather-icons/` via `scripts/import-meteocons.mjs` (black→currentColor, animation stripped, mask ids prefixed); wind/raindrop dropped.

Also shipped: image URL `?v=` from Drive last-modified text (`fileVersion`) so same-name replacements refresh CDN + SW; SW prunes old versions, offline falls back to old copy.

Limits: modified time is minute-resolution; file changed today re-downloads once next day.
