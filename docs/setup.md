# Setup and environment variables

Requires Node 24 (see `.nvmrc`).

```sh
nvm use
npm install
cp .env.example .env.local   # then edit the values
npm run dev                   # http://localhost:3000
```

Other scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:coverage`, `npm run build`.

## Environment variables

| Variable | Required | Meaning |
|---|---|---|
| `DRIVE_FOLDER_ID` | for pictures | ID of the public Drive folder |
| `CALENDAR_ID` | for events | ID of the public Google Calendar |
| `TIMEZONE` | no (default `UTC`) | IANA timezone for folder dates and event times, e.g. `America/New_York` |

Optional weather location (see [Weather](weather.md)): `WEATHER_ZIP` (+ `WEATHER_COUNTRY`, default `US`), or `WEATHER_LATITUDE` + `WEATHER_LONGITUDE`.

Locally they live in `.env.local` (gitignored). On Vercel, set them under Project, Settings, Environment Variables. Only `.env.example`, with placeholders, is committed. The IDs and the calendar feed URL are never sent to the browser. Each source is optional: a missing ID just turns that source off. If there's nothing at all to show, the screen says so instead of staying black, with a line per source explaining why (not set up, couldn't be reached, or simply empty) and which variable to set.

[← Back to the README](../README.md)
