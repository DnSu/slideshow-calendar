# slideshow-calendar

A Next.js app for digital signage. It shows a full-screen slideshow of the images in a public Google Drive folder and, after every few images, an "Upcoming Events" page from a public Google Calendar. It is built to run on [PiSignage](https://pisignage.com) players (Raspberry Pi, Chromium) as a **Web Link**, and keeps working through internet outages.

No Google API key is needed. The Drive folder and the calendar only have to be public.

## Features

- Black background everywhere, images fill the screen (`cover`, edges cropped, no letterboxing) by default, cross-fade, next image preloaded.
- 20 s per image; the calendar for 60 s after every 5 images. All adjustable.
- Date-controlled folders (see below), checked on the screen every minute.
- Calendar: all upcoming events (up to `fetchDays`, default a year ahead), repeating events expanded, large type for a TV. When there are more than fit, they are split into pages and each calendar turn shows the next page. Skipped when there are no upcoming events.
- Weather: a 5-day forecast slide (today large, the next 4 days as rows) right after the calendar, from [Open-Meteo](https://open-meteo.com). Skipped when there is no location or forecast.
- Offline: a service worker saves the page, images and playlist.
- Server data from Google is cached for 60 minutes and shared across Vercel instances. A failed refresh keeps the last good copy.

## Setup

Requires Node 24 (see `.nvmrc`).

```sh
nvm use
npm install
cp .env.example .env.local   # then edit the values
npm run dev                   # http://localhost:3000
```

Other scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:coverage`, `npm run build`.

### Environment variables

| Variable | Required | Meaning |
|---|---|---|
| `DRIVE_FOLDER_ID` | for pictures | ID of the public Drive folder |
| `CALENDAR_ID` | for events | ID of the public Google Calendar |
| `TIMEZONE` | no (default `UTC`) | IANA timezone for folder dates and event times, e.g. `America/New_York` |

Optional weather location (see below): `WEATHER_ZIP` (+ `WEATHER_COUNTRY`, default `US`), or `WEATHER_LATITUDE` + `WEATHER_LONGITUDE`.

Locally they live in `.env.local` (gitignored). On Vercel, set them under Project, Settings, Environment Variables. Only `.env.example`, with placeholders, is committed. The IDs and the calendar feed URL are never sent to the browser. Each source is optional: a missing ID just turns that source off. If there's nothing at all to show, the screen says so instead of staying black, with a line per source explaining why (not set up, couldn't be reached, or simply empty) and which variable to set.

## Make the Drive folder public and find its ID

1. In Google Drive, right-click the folder, Share, General access: **Anyone with the link** (Viewer).
2. Open the folder. The URL looks like `https://drive.google.com/drive/folders/<FOLDER_ID>`. The last part is `DRIVE_FOLDER_ID`.
3. Put image files in it. Only image files are shown, sorted by name (root first, then folders by name).

### Folders for dates

Inside the root folder you can make subfolders (one level only; deeper folders are ignored):

| Folder name | Shown |
|---|---|
| (root folder) | always |
| `2026-12` | until Dec 31, 2026 |
| `2026-12-31` | until Dec 31, 2026 |
| `2026-12-01 2026-12-31` | from Dec 1 through Dec 31, 2026 |
| `0000-06-15 0000-07-05` | **every year**, Jun 15 through Jul 5 |
| `0000-12-15 0000-01-05` | every year, Dec 15 through Jan 5 (wraps over New Year) |
| `0000-06` | every year, all of June |
| `0000-11 0000-12` | every year, Nov 1 through Dec 31 |
| `0000-12-25` | every year, Dec 25 only |

Year `0000` means "every year": only the month and day are matched. Both parts of a range must use `0000`; mixing (`0000-06-15 2026-07-05`) is ignored. `0000-02-29` only shows in leap years.

Dates are whole days (inclusive) in `TIMEZONE`. Any other folder name is ignored and noted in the server log.

For the people who manage the pictures, [`docs/HOW-TO-USE-THIS-FOLDER.txt`](docs/HOW-TO-USE-THIS-FOLDER.txt) explains these rules in plain language. Copy it into the root of the Drive folder; text files are never shown on screen.

### Emergency Override folder

Make a folder named **`Emergency Override`** in the root of the Drive folder. While it holds at least one image, screens show **only** those images (in name order) and skip everything else, including the calendar and weather. Delete or move the images out and the normal slideshow comes back. An empty folder does nothing, so it can stay in place, ready to use.

It goes out like any other change: within about 70 minutes on its own, or within about 10 minutes if someone presses **Refresh** on `/slideshow` after adding or removing the images. `/slideshow` shows "Emergency Override active" while it's on.

## Make the calendar public and find its ID

1. In Google Calendar, open Settings, pick the calendar, Access permissions, tick **Make available to public** (events only need to be visible; "See all event details" shows titles, locations and descriptions).
2. Under Integrate calendar, copy the **Calendar ID** (like `xxxx@group.calendar.google.com`). That is `CALENDAR_ID`.

The app reads the calendar's public iCal feed (`https://calendar.google.com/calendar/ical/<CALENDAR_ID>/public/basic.ics`). Google can take a while to refresh that feed after you edit an event.

## Weather (optional)

The weather slide uses the free [Open-Meteo](https://open-meteo.com) forecast API (no key). Set where it is for, in environment variables only (they are deployment data and are never sent to the browser):

| Variable | Meaning |
|---|---|
| `WEATHER_ZIP` | Simplest: a ZIP / postal code. Looked up once with Open-Meteo's geocoding and cached for weeks. It gives the town's point, which is fine for weather. |
| `WEATHER_COUNTRY` | 2-letter country code for the ZIP; default `US` |
| `WEATHER_LATITUDE`, `WEATHER_LONGITUDE` | More exact. If both are set and valid they are used instead of the ZIP. |

With neither set (or an unknown ZIP), there is no weather slide; a failed lookup is noted in the server log. Settings (`weather.enabled`, `weather.units`, `weather.displaySeconds`, `weather.title`) are below. The forecast is cached with the other sources (60 minutes), and the last good copy is kept on failure. Offline screens pick days by date, hide "current" conditions older than 3 hours, and skip the slide when fewer than 2 forecast days are left.

Open-Meteo is free for **non-commercial** use (data under CC BY 4.0, hence the credit on the slide); commercial use needs one of their paid plans.

### Credits

Weather data: [Open-Meteo.com](https://open-meteo.com) (CC BY 4.0). Icons: [Meteocons](https://github.com/basmilius/meteocons-poc) by Bas Milius (MIT), monochrome set, copied into `src/components/weather-icons/` with its license notice. To refresh them: `npm pack @meteocons/svg`, unpack it, and run `node scripts/import-meteocons.mjs <unpacked package dir>`. The script strips the animation, recolors to `currentColor` and prefixes ids; the package is not a dependency.

Font: [Inter](https://fonts.google.com/specimen/Inter) (SIL Open Font License), self-hosted by `next/font` at build time, so screens never contact Google for it and text looks the same on every player.

## Deploy to Vercel

1. Push the repository to GitHub and import it in Vercel (Framework: Next.js).
2. Add `DRIVE_FOLDER_ID`, `CALENDAR_ID` and `TIMEZONE` (and optionally the weather location) as environment variables.
3. Deploy, then open the URL. A black screen is normal if the folder has no images and the calendar has no events.

Node 24.x (the newest Vercel supports) is pinned via `engines` in `package.json`. The Vercel Hobby plan is for non-commercial use only; business signage needs Pro.

Updates reach screens within about 70 to 80 minutes (60 minutes server cache plus the screen's 10 minute poll). To push a change out sooner, press **Refresh** on `/slideshow`: the server re-reads Google immediately and screens pick it up within about 10 minutes. Date windows are checked on the screen every minute, so they never wait for a refresh. A file replaced under the same name is picked up the same way: the image URL includes a version taken from Drive's "last modified" time, so screens and the CDN fetch the new picture instead of their saved copy.

**New deploys.** Every playlist response carries a release ID, which Vercel provides automatically as `VERCEL_DEPLOYMENT_ID` (keep "Automatically expose System Environment Variables" on, the default). When an online screen sees a different ID from the one its page was loaded with, it reloads, so screens pick up a new deploy within about one playlist check (~10 minutes). It reloads at most once per new release (the 6 hour reload below is the fallback if that doesn't take). Locally the ID is `dev` and no auto-reload happens.

## Add the Web Link in PiSignage

1. In the PiSignage server, Assets, Add a **Web Link** with your Vercel URL (for example `https://your-project.vercel.app/`).
2. Add it to a playlist (or a playlist's zone) with a long duration, or as the only asset, so the player stays on it.
3. Assign the playlist to the group or player and deploy.

## Offline behavior and the reboot test

The first load needs internet. After that, a service worker saves the page, every image and the latest playlist in the Pi's browser, and asks the browser to keep that storage (`navigator.storage.persist()`). Images that left the playlist are deleted, and saved app files from older deploys are cleaned up after a page loads from the network. While offline the screen keeps going: folder windows and event times are checked locally, the 6 hour page reload and the new-deploy reload are skipped (an offline screen keeps the old version and updates after it reconnects), and a small amber dot appears in the bottom-right corner (turn it off with `offline.showIndicator`).

The screen never trusts a clock earlier than the last successful contact with the server, because a Pi without a battery-backed clock restarts at its last saved time.

**Test this on your own player before relying on it** (it depends on PiSignage's browser keeping its storage across reboots):

1. Let the player show the Web Link online for a few minutes (a full cycle is about 2 min 40 s).
2. Unplug the network (or block the player at your router).
3. Confirm the slideshow keeps running and the dot appears.
4. Reboot the player while it is still offline.
5. After it starts, confirm the slideshow comes back. If it stays black, the browser is wiping its storage; use the fallback of packaging the app as a PiSignage offline web asset (zip).

## Developer previews (`/slideshow`, `/calendar`, `/weather`)

The signage screen runs at `/`. Three preview pages share a menu at the top for switching between them. The menu also has a **Sample data** toggle (made-up events and a made-up forecast, handy while the real ones are empty; same as adding `?demo`) and a link that opens the real screen. Both pages show a portrait **9:16** frame sized to the browser window, with controls below it. The content is scaled to the frame. None is linked from the screen, and all are marked `noindex`.

**`/slideshow`** shows the same images, calendar pages, fit and weather as the screen, in a simpler loop: every active image once (in playlist order), then each calendar page once (if there are events), then the weather (if there is a forecast), then back to the first image. This is shorter than the real screen's order, where the calendar and weather come after every `showAfterImages` images.

- **It never advances on its own.** Use **◀ Prev** / **Next ▶** (or the ← / → keys); Prev wraps from the first slide to the last, and Next from the last to the first. **Restart** goes back to slide 1.
- **Refresh** makes the server read Drive, the calendar and the weather again right away, instead of waiting for its hourly refresh, then shows the new copy. Use it after adding, replacing or removing pictures. Screens get the fresh copy at their next playlist check (within `refresh.playlistMinutes`, 10 by default). The server accepts it at most every 30 seconds.
- **Active now / All images** switches what the loop includes. **Active now** (the default) shows only the images on screen today. **All images** adds every-year folders outside their dates and folders whose dates haven't started yet, so you can check upcoming pictures; the line below the buttons marks those as "not on screen now". Folders that have ended are never included.
- The line between the buttons shows the position ("Slide 2 of 6", counting images, calendar pages and weather), when the image shows, in words such as "every year Jun 25th to Jul 5th" or "until Dec 31st, 2026" (or the calendar page, or weather), and how long it stays up on the real screen.

**`/calendar`** shows only the calendar, drawn the way the screen draws it.

- Pages rotate on the same `displaySeconds` timing as the screen. **Pause** stops the rotation, and **◀ Prev** / **Next ▶** (or ← / →) step through pages.
- `/calendar?page=2` opens paused on page 2.

**`/weather`** shows only the weather slide, in the same frame. **Reload** fetches the forecast again; the line below says when it was updated, or why it is hidden. With sample data, **◀ Prev** / **Next ▶** switch between four made-up forecasts that together use every icon.

## Settings and the Drive `config.json` override

Behavior defaults are in `slideshow.config.json` (no IDs or URLs). To change them without redeploying, put a file named exactly `config.json` in the **root** of the Drive folder. A ready-to-copy template with every setting Drive can change, at its default value, is in [`docs/config.json`](docs/config.json) (a test keeps it in sync with the defaults). It is never shown as a slide. Anything you leave out keeps its default; an invalid value is ignored (default used) and noted in the server log; invalid JSON ignores the whole file.

Example:

```json
{
  "timezone": "America/Chicago",
  "slideshow": { "imageSeconds": 15, "imageFit": "cover", "transitionMs": 800 },
  "calendar": {
    "showAfterImages": 4,
    "displaySeconds": 45,
    "eventsPerPage": 6,
    "title": "This Week"
  },
  "refresh": { "playlistMinutes": 5, "pageReloadHours": 12 },
  "offline": { "showIndicator": false },
  "weather": { "units": "celsius", "displaySeconds": 20 }
}
```

| Setting | Meaning | Drive can change? |
|---|---|---|
| `DRIVE_FOLDER_ID`, `CALENDAR_ID` | which folder and calendar | No (environment only) |
| `refresh.sourceMinutes` | how often the server reads Google | No |
| `timezone` | overrides `TIMEZONE` | Yes |
| `slideshow.imageSeconds` | seconds per image | Yes |
| `slideshow.imageFit` | `cover` (default: fill the screen, crops edges) or `contain` (whole image, black bars) | Yes |
| `slideshow.transitionMs` | cross-fade length | Yes |
| `calendar.showAfterImages` | images between calendar pages | Yes |
| `calendar.displaySeconds` | seconds for the calendar page | Yes |
| `calendar.fetchDays` | how far ahead (days) to look for events; all of them are shown | Yes |
| `calendar.eventsPerPage` | events per calendar page; more events → more pages, one page per calendar turn | Yes |
| `calendar.title` | page heading | Yes |
| `refresh.playlistMinutes` | how often the screen asks for updates | Yes |
| `refresh.pageReloadHours` | full page reload interval | Yes |
| `offline.showIndicator` | show the offline dot | Yes |
| `weather.enabled` | show the weather slide (needs a location in the environment) | Yes |
| `weather.units` | `fahrenheit` (default) or `celsius`; wind follows (mph or km/h) | Yes |
| `weather.displaySeconds` | seconds for the weather slide (15) | Yes |
| `weather.title` | slide heading | Yes |
| `WEATHER_ZIP`, `WEATHER_COUNTRY`, `WEATHER_LATITUDE`, `WEATHER_LONGITUDE` | weather location | No (environment only) |

## Notes and limits

- **Unofficial Drive page.** Folder contents come from `drive.google.com/embeddedfolderview`, which is not a documented API. Google could change it. Only `src/lib/drive.ts` knows its layout; screens keep showing saved content in the meantime. If the page is not recognised, the server keeps its previous listing.
- An emptied folder is read as empty normally, but a page the app does not recognise at all never replaces the last good listing.
- Images are served at 1920 px wide through `/api/image/<id>`, which only serves files that are in the current playlist.
- Server logs (Vercel, Logs) note ignored folders, bad settings and failed refreshes.

## Layout

```
slideshow.config.json        default settings
src/lib/config.ts            env vars, defaults, Drive override merge, validation (zod)
src/lib/folderDates.ts       folder names to date windows
src/lib/drive.ts             Drive listing, config.json download, thumbnails
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

## License

[MIT](LICENSE)
