# slideshow-calendar

A Next.js app for digital signage. It shows a full-screen slideshow of the images in a public Google Drive folder and, after every few images, an "Upcoming Events" page from a public Google Calendar. It is built to run on [PiSignage](https://pisignage.com) players (Raspberry Pi, Chromium) as a **Web Link**, and keeps working through internet outages.

No Google API key is needed. The Drive folder and the calendar only have to be public.

## Features

- Black background everywhere, images fill the screen (`cover`, edges cropped, no letterboxing) by default, cross-fade, next image preloaded.
- 20 s per image; the calendar for 60 s after every 5 images. All adjustable.
- Date-controlled folders (see below), checked on the screen every minute.
- Calendar: all upcoming events (up to `fetchDays`, default a year ahead), repeating events expanded, large type for a TV. When there are more than fit, they are split into pages and each calendar turn shows the next page. Skipped when there are no upcoming events.
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

Other scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

### Environment variables

| Variable | Required | Meaning |
|---|---|---|
| `DRIVE_FOLDER_ID` | yes | ID of the public Drive folder |
| `CALENDAR_ID` | yes | ID of the public Google Calendar |
| `TIMEZONE` | no (default `UTC`) | IANA timezone for folder dates and event times, e.g. `America/New_York` |

Locally they live in `.env.local` (gitignored). On Vercel, set them under Project, Settings, Environment Variables. Only `.env.example`, with placeholders, is committed. The IDs and the calendar feed URL are never sent to the browser. If a required variable is missing, `/api/playlist` answers with an error that names it.

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

## Make the calendar public and find its ID

1. In Google Calendar, open Settings, pick the calendar, Access permissions, tick **Make available to public** (events only need to be visible; "See all event details" shows titles, locations and descriptions).
2. Under Integrate calendar, copy the **Calendar ID** (like `xxxx@group.calendar.google.com`). That is `CALENDAR_ID`.

The app reads the calendar's public iCal feed (`https://calendar.google.com/calendar/ical/<CALENDAR_ID>/public/basic.ics`). Google can take a while to refresh that feed after you edit an event.

## Deploy to Vercel

1. Push the repository to GitHub and import it in Vercel (Framework: Next.js).
2. Add `DRIVE_FOLDER_ID`, `CALENDAR_ID` and `TIMEZONE` as environment variables.
3. Deploy, then open the URL. A black screen is normal if the folder has no images and the calendar has no events.

Node 24.x (the newest Vercel supports) is pinned via `engines` in `package.json`. The Vercel Hobby plan is for non-commercial use only; business signage needs Pro.

Updates reach screens within about 70 to 80 minutes (60 minutes server cache plus the screen's 10 minute poll). Date windows are checked on the screen every minute, so they never wait for a refresh. A replaced image file keeps its Drive ID and can take up to 7 days to change; upload it as a new file to show it right away.

## Add the Web Link in PiSignage

1. In the PiSignage server, Assets, Add a **Web Link** with your Vercel URL (for example `https://your-project.vercel.app/`).
2. Add it to a playlist (or a playlist's zone) with a long duration, or as the only asset, so the player stays on it.
3. Assign the playlist to the group or player and deploy.

## Offline behavior and the reboot test

The first load needs internet. After that, a service worker saves the page, every image and the latest playlist in the Pi's browser, and asks the browser to keep that storage (`navigator.storage.persist()`). Images that left the playlist are deleted. While offline the screen keeps going: folder windows and event times are checked locally, the 6 hour page reload is skipped, and a small amber dot appears in the bottom-right corner (turn it off with `offline.showIndicator`).

The screen never trusts a clock earlier than the last successful contact with the server, because a Pi without a battery-backed clock restarts at its last saved time.

**Test this on your own player before relying on it** (it depends on PiSignage's browser keeping its storage across reboots):

1. Let the player show the Web Link online for a few minutes (a full cycle is about 2 min 40 s).
2. Unplug the network (or block the player at your router).
3. Confirm the slideshow keeps running and the dot appears.
4. Reboot the player while it is still offline.
5. After it starts, confirm the slideshow comes back. If it stays black, the browser is wiping its storage; use the fallback of packaging the app as a PiSignage offline web asset (zip).

## Calendar preview (`/calendar`)

The signage screen runs at `/`. For checking the calendar page on its own, open `/calendar`:

- Shows the live calendar exactly as the screen draws it, rotating pages on the same `displaySeconds` timing.
- `/calendar?demo` uses made-up events (handy while the real calendar is empty, or to check layout and paging).
- `/calendar?page=2` stays on one page; the ← / → keys step through pages.
- It is not linked from the screen and is marked `noindex`. It only shows what the public calendar already shows.

## Slideshow preview (`/slideshow`)

For checking content without waiting on the timer, open `/slideshow`:

- A portrait **9:16** frame sized to fit the browser window, showing the same images, calendar pages, fit, and order as the screen. The calendar is scaled to the frame.
- **It never advances on its own.** Use the **◀ Prev** / **Next ▶** buttons below the frame (or the ← / → keys); **Restart** goes back to the first slide.
- The line between the buttons shows the slide number, the image's file name and date window (or the calendar page), and how long it stays up on the real screen.
- `/slideshow?demo` uses made-up calendar events.
- Like `/calendar`, it is not linked from the screen and is marked `noindex`.

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
  "offline": { "showIndicator": false }
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
src/lib/events.ts            upcoming events, calendar pages
src/lib/eventLabels.ts       time and multi-day labels
src/app/calendar, slideshow  developer previews
src/app/api/playlist         playlist JSON
src/app/api/image/[id]       image proxy
src/components/              Player, CalendarSlide, OfflineDot, CalendarPreview, SlideshowPreview
public/sw.js                 service worker
tests/                       vitest tests and fixtures (fake IDs only)
```

## License

[MIT](LICENSE)
