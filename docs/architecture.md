# How it works: notes, limits and code layout

## Notes and limits

- **Unofficial Drive page.** Folder contents come from `drive.google.com/embeddedfolderview`, which is not a documented API. Google could change it. Only `src/lib/drive.ts` knows its layout; screens keep showing saved content in the meantime. If the page is not recognised, the server keeps its previous listing.
- An emptied folder is read as empty normally, but a page the app does not recognise at all never replaces the last good listing.
- Images are served at 1920 px wide through `/api/image/<id>`, which only serves files that are in the current playlist.
- Server logs (Vercel, Logs) note ignored folders, bad settings and failed refreshes.

## Code layout

```
slideshow.config.json        default settings
src/lib/config.ts            env vars, defaults, Drive override merge, validation (zod)
src/lib/folderDates.ts       folder names to date windows
src/lib/settingsText.ts      the settings Doc format (NAME = value), parse and write
src/lib/driveIssues.ts       plain-language notes on Drive files and folders that won't show
src/lib/drive.ts             Drive listing, settings Doc export / config file download, thumbnails
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
