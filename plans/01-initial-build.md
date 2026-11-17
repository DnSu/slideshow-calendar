# 01 — Initial build (done)

Next.js (App Router, TypeScript) on Vercel, shown on PiSignage players as a Web Link. Node 24.x.

## What was built
- **Slideshow** from a public Google Drive folder, full screen on black, `cover` fit (no letterboxing), cross-fade, next image preloaded.
  - Root images: always. First-level subfolders only, named `YYYY-MM`, `YYYY-MM-DD` (shown until that date), or `YYYY-MM-DD YYYY-MM-DD` (from–to). Dates are inclusive, in the configured timezone. Malformed names are ignored.
- **Calendar** from a public Google Calendar's iCal feed, after every 5 images.
  - Shows all upcoming events up to `fetchDays` (365) ahead, repeats expanded, HTML stripped from descriptions, grouped by day.
  - Pages of `eventsPerPage` (8); each calendar turn shows the next page ("Page X of Y").
  - Multi-day events are listed once, under their first day (or Today while running), with a range or "Day N of M" line and an accent bar. They stay until they end.
  - Skipped entirely when there are no upcoming events.
- **Timing:** 20 s per image, 60 s per calendar page.
- **Developer previews** (not linked, `noindex`):
  - `/calendar`: calendar page only. `?demo` for sample events, `?page=N`, ← / →.
  - `/slideshow`: portrait 9:16 frame, manual only (Prev / Next / Restart buttons and ← / →), shows each slide's file, date window, and time on screen. `?demo`.

## Key decisions
- **Next.js, not plain React:** the iCal feed and Drive's folder page block cross-origin browser reads, and a server lets one cached copy serve every screen.
- **No Google API key.** The calendar uses the public iCal feed. Drive is listed by reading `drive.google.com/embeddedfolderview`, an undocumented page; only `src/lib/drive.ts` knows its layout.
- **Settings** come from three places, merged and validated with zod in `src/lib/config.ts`:
  - env vars `DRIVE_FOLDER_ID`, `CALENDAR_ID`, `TIMEZONE` (deployment-specific, never committed);
  - `slideshow.config.json` (behavior defaults only);
  - an optional `config.json` in the Drive folder root, overriding defaults without a redeploy. Bad values fall back to defaults. IDs and `refresh.sourceMinutes` can't be overridden from Drive.
- **Caching:** the server reads Google every 60 min (`'use cache: remote'`), keeps the last good copy on failure, and never sends the IDs or feed URL to the browser. Screens poll every 10 min; `/api/image/[id]` serves only IDs in the playlist, with a 7-day CDN cache.
- **Offline:** a service worker (production only) saves the page, images, and playlist; requests persistent storage; prunes unused images. Date windows and event times are checked on the screen every minute. The screen never trusts a clock earlier than the last server contact. The 6 h reload is skipped while offline. An optional offline dot shows when content is from the saved copy.
- **Sizing:** calendar CSS uses `--vh`/`--vw` (1% of the screen) so previews can scale it to their frame.
- **Open source:** MIT license. No real IDs, URLs, or personal details in the repo; tests use fake fixtures.

## Known limits
- Drive subfolder entries and the `config.json` download are unverified against a live page.
- A page of 8 events with long descriptions can overflow the screen height (no fit-to-screen paging yet).
- The offline reboot test on a real PiSignage player hasn't been run.
