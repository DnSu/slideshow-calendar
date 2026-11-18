# How it works: notes, limits and code layout

## Notes and limits

- **Unofficial Drive page.** Folder contents come from `drive.google.com/embeddedfolderview`, which is not a documented API. Google could change it. Only `src/lib/drive.ts` knows its layout; screens keep showing saved content in the meantime. If the page is not recognised, the server keeps its previous listing.
- An emptied folder is read as empty normally, but a page the app does not recognise at all never replaces the last good listing.
- Images are served through `/api/image/<id>?v=<version>`, which only serves files in the current playlist at their current version (so a made-up `?v=` can't skip the CDN cache). It asks Drive for a thumbnail at most 1920 px wide, passes on only raster types (JPEG, PNG, GIF, WebP, AVIF, BMP) with `nosniff` and a sandbox CSP, and passes pictures that already fit (long side ≤ 1920 px and ≤ 3.5 MB) through untouched. Bigger ones are fitted inside 1920 × 1920 as WebP (quality 90, `sharp`) so they load fast and stay under Vercel's 4.5 MB response limit; those carry `X-Shrunk-From-Bytes` / `X-Shrunk-To-Bytes`, which `/slideshow` reads with HEAD requests to list them in its problems box. Drive's thumbnails of PNGs are lossless (checked pixel for pixel against the originals).
- Server logs (Vercel, Logs) note ignored folders, bad settings and failed refreshes.

## Code layout

```
slideshow.config.json        default settings
src/lib/config.ts            env vars, defaults, Drive override merge, validation (zod)
src/lib/folderDates.ts       folder names to date windows
src/lib/settingsText.ts      the settings Doc format (NAME = value), parse and write
src/lib/driveIssues.ts       plain-language notes on Drive files and folders that won't show
src/lib/drive.ts             Drive listing, settings Doc export / config file download, thumbnails
src/lib/imageResponse.ts     image proxy rules: raster types only, safe headers, shrinking oversized pictures
src/lib/calendar.ts          iCal fetch and parse (node-ical)
src/lib/playlist.ts          cached sources and the playlist
src/lib/slides.ts            slide order and timing, clock check
src/lib/weather.ts           Open-Meteo forecast and ZIP lookup (zod-validated)
src/lib/weatherCodes.ts      WMO weather code to icon and label
src/lib/weatherView.ts       which days and conditions to show right now
src/lib/events.ts            upcoming events, calendar pages
src/lib/eventLabels.ts       time and multi-day labels
src/app/(preview)/           developer previews (calendar, slideshow, weather) and their shared menu
src/app/api/playlist         playlist JSON
src/app/api/image/[id]       image proxy
src/components/              Player, CalendarSlide, WeatherSlide, OfflineDot, previews and PreviewNav,
                             each with its styles in Foo.module.css
src/app/globals.css          color and font variables, reset, page base
src/components/weather-icons Meteocons icons (generated) and their license
scripts/import-meteocons.mjs regenerates the icons
public/sw.js                 service worker
src/**/*.test.ts             vitest tests, next to the code they test
src/lib/__fixtures__/        sample Drive pages and calendar feeds for tests (fake IDs only)
```

## Credits

- Weather data: [Open-Meteo.com](https://open-meteo.com) (CC BY 4.0).
- Weather icons: [Meteocons](https://github.com/basmilius/meteocons-poc) by Bas Milius (MIT). See [Weather](weather.md#credits) for how they're imported.
- Font: [Inter](https://fonts.google.com/specimen/Inter) (SIL Open Font License), self-hosted by `next/font` at build time, so screens never contact Google for it and text looks the same on every player.

[← Back to the README](../README.md)
