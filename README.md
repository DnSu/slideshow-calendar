# slideshow-calendar

A Next.js app for digital signage. It shows a full-screen slideshow of the images in a public Google Drive folder and, after every few images, an "Upcoming Events" page from a public Google Calendar and a 5-day weather forecast. It runs on [PiSignage](https://pisignage.com) players (Raspberry Pi, Chromium) as a **Web Link**, and keeps working through internet outages.

No Google API key is needed. The Drive folder and the calendar only have to be public.

## Features

- **Slideshow** from a Google Drive folder: full screen on black, cross-fade, 20 s per image.
- **Date folders** decide when pictures show (`2026-12`, `2026-12-01 2026-12-31`, or every year with `0000-06-15 0000-07-05`), plus an **Emergency Override** folder that replaces everything while it has pictures.
- **Upcoming events** from Google Calendar after every 5 images, paged, with multi-day events.
- **Weather**: today large and the next 4 days, from Open-Meteo, by ZIP code.
- **Works offline**: screens keep running from saved content, and update themselves after a new deploy.
- **Settings without redeploying**: a `config.json` in the Drive folder.
- **Friendly empty screen**: if there's nothing to show, the screen says why.
- **Developer previews** at `/slideshow`, `/calendar` and `/weather`.

## Quick start

Requires Node 24 (see `.nvmrc`).

```sh
nvm use
npm install
cp .env.example .env.local   # then fill in the IDs
npm run dev                   # http://localhost:3000
```

## Documentation

| Guide | What's in it |
|---|---|
| [Setup](docs/setup.md) | Local development, scripts, environment variables |
| [Google Drive](docs/google-drive.md) | Making the folder public, date folders, Emergency Override, replacing pictures |
| [Google Calendar](docs/google-calendar.md) | Making the calendar public and finding its ID |
| [Weather](docs/weather.md) | ZIP or coordinates, Open-Meteo terms, icon credits |
| [Settings](docs/settings.md) | Every setting, and changing them from Drive with `config.json` |
| [Deploy](docs/deploy.md) | Vercel, PiSignage Web Link, how fast updates reach screens |
| [Offline](docs/offline.md) | What happens without internet, and the reboot test |
| [Developer previews](docs/previews.md) | `/slideshow`, `/calendar`, `/weather` and their controls |
| [How it works](docs/architecture.md) | Limits, code layout, credits |

For the people who manage the pictures: [`docs/HOW-TO-USE-THIS-FOLDER.txt`](docs/HOW-TO-USE-THIS-FOLDER.txt) explains the folder rules in plain language, and [`docs/config.json`](docs/config.json) is a settings template. Both can be copied into the Drive folder; they're never shown on screen.

## License

[MIT](LICENSE). Weather data by [Open-Meteo.com](https://open-meteo.com) (CC BY 4.0); icons by [Meteocons](https://github.com/basmilius/meteocons-poc) (MIT); font [Inter](https://fonts.google.com/specimen/Inter) (OFL).
