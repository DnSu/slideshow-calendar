# 01 initial build — done

Next.js App Router + TS on Vercel, Node 24.x. PiSignage Web Link. No Google API key.

Built:
- Slideshow from public Drive folder. Root imgs always. 1-level subfolders: `YYYY-MM`, `YYYY-MM-DD` (until), `YYYY-MM-DD YYYY-MM-DD`; inclusive, in TIMEZONE; bad names ignored. Black bg, `cover`, cross-fade, preload next.
- Calendar (public iCal) after every `showAfterImages` (5) imgs, 60 s/page, `eventsPerPage` (8), all future events ≤ `fetchDays`; multi-day listed once under first day / today, "Day N of M" + gold bar, stays till end. Skipped if empty.
- `/calendar`, `/slideshow` previews (noindex): 9:16 frame, manual controls, `?demo`.

Decisions:
- Server needed: iCal + Drive folder page block CORS; one cached copy for all screens.
- Drive via undocumented `embeddedfolderview`; only `src/lib/drive.ts` knows layout. Images via `drive.google.com/thumbnail?sz=w1920`, proxied by `/api/image/[id]` (playlist IDs only, 7-day CDN).
- Settings: env (`DRIVE_FOLDER_ID`, `CALENDAR_ID`, `TIMEZONE`) + `slideshow.config.json` + Drive root `config.json` override, zod-merged in `config.ts`; bad values → defaults; `refresh.sourceMinutes` env/code only.
- Cache: `'use cache: remote'` + `cacheLife("source")` 60 min, last-good fallback, `degraded` list. Screens poll 10 min.
- Offline: SW (prod only) caches shell/images/playlist, `storage.persist()`, prunes images; clock floor = last serverTime; 6 h reload only when online; offline dot.
- Calendar CSS in `--vh/--vw` so previews scale it.

Open: 8 events w/ long descriptions can overflow; offline reboot test on real Pi not run.
