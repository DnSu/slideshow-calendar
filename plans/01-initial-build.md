# PiSignage Slideshow + Calendar — Plan

Next.js app hosted on Vercel, shown on PiSignage players as a **Web Link**.
No Google API key: reads a public Google Drive folder and a public Google Calendar.

## 1. What it does

1. **Slideshow:** full-screen images from a public Google Drive folder, on a **black background**. Images fill the whole screen (`cover`) by default, cropping edges as needed, with no letterboxing. The page, cross-fades, and loading states are black too, so the screen never flashes white.
2. **Calendar:** after every 5 images, a full-screen "Upcoming Events" page from a public Google Calendar.

## 2. Content rules

### Drive folders (one level only)
| Location / folder name | Shown |
|---|---|
| Root folder | Always |
| `2026-12` | Until Dec 31, 2026 |
| `2026-12-31` | Until Dec 31, 2026 |
| `2026-12-01 2026-12-31` | From Dec 1 through Dec 31, 2026 |
| Anything else (bad date, end before start, other text) | Ignored, noted in the server log |

- Dates count as whole days (start day through end day) in the configured timezone.
- Folders inside subfolders are ignored.
- Only image files are shown, sorted by name (root first, then folders by name).
- `config.json` in the root is the settings override (see §3), never a slide.

### Calendar
- Comes from the public iCal feed `https://calendar.google.com/calendar/ical/<CALENDAR_ID>/public/basic.ics`.
- Repeating events are expanded. Each event shows its date, time (or "All day"), title, location, and description (HTML removed, shortened).
- **All future events are shown** (the server looks up to `fetchDays` = 365 days ahead). More than `eventsPerPage` (8) → split into pages; each calendar turn shows the next page, with a "Page X of Y" label.
- **`/calendar`**: developer preview of the calendar page only (`?demo` sample events, `?page=N`, ← / →). The player stays at `/`.
- **No upcoming events → calendar page is skipped.** No images but some events → calendar stays on screen. Neither → black screen.

### Timing
- Each image: **20 s**. Calendar: **60 s**, after every **5** images. One full cycle ≈ 2 min 40 s.

## 3. Settings

Three sources, merged and validated by one settings module (`src/lib/config.ts`):

1. **Environment variables (deployment-specific, never committed):** which Drive folder and calendar to read.
2. **Defaults in code:** `slideshow.config.json`, committed. Contains **no IDs, URLs, or other deployment data**, only behavior defaults.
3. **Override on Drive:** an optional `config.json` in the root of the public Drive folder. Values there replace the code defaults; anything left out keeps its default.
   A missing file, invalid JSON, or a bad value → that value is ignored and the default used, with a note in the server log.

### Environment variables
| Variable | Required | Example |
|---|---|---|
| `DRIVE_FOLDER_ID` | Yes | the ID from the folder's share link |
| `CALENDAR_ID` | Yes | `xxxx@group.calendar.google.com` |
| `TIMEZONE` | No (default `UTC`) | `America/New_York` |

- Set in Vercel → Project → Settings → Environment Variables; locally in `.env.local`.
- The repo commits only `.env.example` with placeholder values. `.gitignore` excludes `.env*` except `.env.example`.
- The app fails at startup with a clear message if a required variable is missing.
- The IDs are **never sent to the browser**: the playlist JSON carries image IDs and event data only, not the folder ID, calendar ID, or feed URL.

### Code defaults (`slideshow.config.json`)
```json
{
  "slideshow": { "imageSeconds": 20, "imageFit": "cover", "transitionMs": 1000 },
  "calendar": {
    "showAfterImages": 5, "displaySeconds": 60,
    "fetchDays": 365, "eventsPerPage": 8, "title": "Upcoming Events"
  },
  "refresh": { "sourceMinutes": 60, "playlistMinutes": 10, "pageReloadHours": 6 },
  "offline": { "showIndicator": true }
}
```

| Setting | Can Drive change it? |
|---|---|
| `DRIVE_FOLDER_ID`, `CALENDAR_ID` | No. Environment only. |
| `refresh.sourceMinutes` | No. It sets how often Drive itself is read. |
| `TIMEZONE` and everything in `slideshow.config.json` | Yes |

### Open-source hygiene
- No real folder IDs, calendar IDs, feed URLs, Vercel project IDs, or personal details anywhere in the repo, including tests, README, and examples. Tests use made-up IDs and saved sample responses (Drive page HTML, `.ics`) with fake data.
- `.vercel/` is gitignored.
- Add an MIT `LICENSE` (or another license you choose).

## 4. Refreshing

| Step | Interval | Notes |
|---|---|---|
| Server reads Google (Drive listing, Drive `config.json`, calendar) | 60 min | Uses the Vercel Data Cache, so all screens and server instances share one copy. A failed read keeps the last good copy. |
| Screen asks the server for the latest playlist | 10 min | A failed request keeps the last good playlist. |
| Screen reloads the page | 6 h | Skipped while offline. |

A new image, folder, event, or setting can take up to about 70 min to reach a screen.
Expiry and start dates are checked **on the screen every minute**, so they don't wait for a refresh.

## 5. Offline behavior

- **Service worker** saves the page, every image, and the latest playlist (with settings) in the Pi's browser.
- Uses `navigator.storage.persist()` so the browser won't delete saved data on its own; images that left the playlist are deleted.
- Folder date windows and event times are checked on the Pi, so content keeps changing correctly offline.
- **Clock check:** never trusts a time earlier than the last successful refresh (Pis without an RTC battery restart at their last saved time).
- Optional small dot in a corner while showing saved content (`offline.showIndicator`).

| Situation | Result |
|---|---|
| Internet drops while running | Keeps running for as long as the outage lasts |
| Reboot while offline | Works **if PiSignage's browser keeps its storage** (must test) |
| Never been online | Black screen (first load needs internet) |
| Outage of weeks | Gradually less content as events run out and folders expire |
| Vercel or Google down | Same as no internet; server keeps its last good copy |

Fallback if the reboot test fails: package the app as a PiSignage offline web asset (zip).

## 6. Architecture

```
slideshow.config.json        default settings
src/lib/config.ts            env vars + defaults + Drive override merge + validation (zod)
.env.example                 placeholder env vars (the only env file committed)
src/lib/folderDates.ts       parse folder names → {start, end}; isActive(date, tz)
src/lib/drive.ts             list public folder via drive.google.com/embeddedfolderview
                             (only file that knows Drive's page layout); fetch config.json
src/lib/calendar.ts          fetch + parse the iCal feed (node-ical), expand repeats
src/lib/playlist.ts          builds {images, events, config, fetchedAt}; cached sourceMinutes
src/app/api/playlist/route.ts    returns the playlist JSON
src/app/api/image/[id]/route.ts  proxies drive.google.com/thumbnail?id=<id>&sz=w1920;
                                 only IDs in the current playlist; long CDN cache
src/app/page.tsx             full-screen player (client component)
src/components/Player.tsx    slide order, timing, cross-fade, preloading, date checks
src/components/CalendarSlide.tsx  events grouped by day, large readable type
src/components/OfflineDot.tsx
public/sw.js                 service worker: page + images + playlist cache
tests/                       folder-name parsing, active window, timezone and month edges,
                             config merge/validation, slide order logic
README.md
```

The playlist sends each folder's date window to the screen, not only a filtered list, so the screen can apply the rules offline.

## 7. Build steps

1. Node.js is pinned to **26.x**, Vercel's default and newest supported version (also LTS). `.nvmrc` holds `26` for local nvm, and `package.json` will hold `"engines": { "node": "26.x" }` so Vercel builds and runs on the same version.
2. Scaffold Next.js (latest, App Router, TypeScript); add `zod`, `node-ical`, `vitest`.
3. Settings module + folder-date parser, with tests.
4. Drive reader + calendar reader + cached playlist route; test against the real folder and calendar.
5. Image proxy route.
6. Player UI: image slides, calendar slide, timing, transitions.
7. Service worker + offline logic + clock check.
8. README: making the folder and calendar public, finding their IDs, deploying to Vercel, adding the Web Link in PiSignage, the offline reboot test.
9. Deploy to Vercel and test on a real PiSignage player.

## 8. Notes / risks

- **Unofficial Drive page:** Google could change `embeddedfolderview`. The screens keep showing saved content, and only `src/lib/drive.ts` would need fixing.
- **Vercel Hobby (free) plan is for non-commercial use only.** Business signage needs the Pro plan.
- Images are served at 1920 px wide, about 200–400 KB each.
- A replaced image file keeps its Drive ID, so it can take up to the image cache time (7 days) to change. Uploading it as a new file shows it right away.

## 9. You will provide

Set these as environment variables (Vercel settings and your local `.env.local`), not in the repo:
- `DRIVE_FOLDER_ID`: the public Drive folder ID (from the folder's share link).
- `CALENDAR_ID`: the public Calendar ID (Calendar settings → Integrate calendar).
- `TIMEZONE`: your timezone.
