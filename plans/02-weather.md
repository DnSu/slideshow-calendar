# 02 — 5-day weather slide (done)

## What was built
- **Weather slide** in the rotation, right after the calendar in each info turn. With no events it shows alone, and it's skipped when there's no usable forecast. 15 s on screen.
  - Today takes about the top 55%, with generous space: a large icon, the current temperature, the condition, then two quiet gray lines ("Feels like · H · L" and "Rain · Wind").
  - The next 4 days are compact rows: day, icon, rain %, high / low.
  - A one-line footer: "Updated h:mm · Weather: Open-Meteo.com · Icons: Meteocons".
- **`/weather` preview:** a tab in the preview menu, in the same 9:16 frame and controls as `/calendar`. With sample data, Prev and Next switch between four made-up forecasts; Reload refetches. The menu toggle is now "Sample data".
- **`/slideshow` preview order:** each active image once, then each calendar page, then weather, then it loops (`previewCycle`). "Slide N of M" counts that cycle. The real player's order is unchanged.

## Key decisions
- **Open-Meteo**: no key, JSON, one request for current conditions and 5 days. Free for **non-commercial** use only; the data is CC BY 4.0, hence the credit. The US National Weather Service is the fallback if the use counts as commercial.
- **Location** from env only, never sent to the browser. `WEATHER_LATITUDE` + `WEATHER_LONGITUDE` win when both are valid. Otherwise `WEATHER_ZIP` (+ `WEATHER_COUNTRY`, default `US`) is geocoded with Open-Meteo's geocoding API and cached 30 days (the `location` cache profile). With neither, weather is off.
- **Settings** (Drive-overridable): `weather.enabled`, `weather.units` (Fahrenheit by default), `weather.displaySeconds` (15), `weather.title`.
- **Fetching:** the forecast uses the same 60-min server cache and last-good fallback as Drive and the calendar. Bad data means no weather, never an error. A configured location that fails with no earlier copy adds `"weather"` to `degraded`.
- **Offline:** days are picked by date on the screen; with fewer than 2 left, the slide is skipped. Current conditions are hidden when older than 3 hours.
- **Icons:** Meteocons monochrome (MIT, Bas Milius), copied into `src/components/weather-icons/` rather than depended on, because the package is 0.1.0. `scripts/import-meteocons.mjs` redoes the copy: it turns black into `currentColor`, removes the animation (freezing it on a sensible frame), drops the clip rectangle, and prefixes mask ids. The wind and raindrop icons are left out because they don't read well without animation. The package has no LICENSE file, so the standard MIT text with the author's name was added.

## Also in this change
- **Replaced images refresh:** the Drive listing's "last modified" text becomes a short version (`fileVersion`) in the image URL (`/api/image/<id>?v=…`). A file replaced under the same name gets a new URL, so the CDN and the service worker fetch the new picture. The service worker prunes old versions and, while offline, falls back to the older saved copy.

## Known limits
- The weather slide hasn't been watched on the real player at `/`.
- Drive shows modified times only to the minute, so two replacements within one minute can be missed. A file changed today gets one extra re-download the next day, when Drive's text switches from a time to a date.
