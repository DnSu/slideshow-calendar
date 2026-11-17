# Deploy to Vercel and PiSignage

## Vercel

1. Push the repository to GitHub and import it in Vercel (Framework: Next.js).
2. Add `DRIVE_FOLDER_ID`, `CALENDAR_ID` and `TIMEZONE` (and optionally the weather location) as environment variables.
3. Deploy, then open the URL. If there's nothing to show yet, the screen says why (for example, a source that isn't set up).

Node 24.x (the newest Vercel supports) is pinned via `engines` in `package.json`. The Vercel Hobby plan is for non-commercial use only; business signage needs Pro.

## How updates reach the screens

Updates reach screens within about 70 to 80 minutes (60 minutes server cache plus the screen's 10 minute poll). To push a change out sooner, press **Refresh** on `/slideshow`: the server re-reads Google immediately and screens pick it up within about 10 minutes. Date windows are checked on the screen every minute, so they never wait for a refresh. A file replaced under the same name is picked up the same way: the image URL includes a version taken from Drive's "last modified" time, so screens and the CDN fetch the new picture instead of their saved copy.

**New deploys.** Every playlist response carries a release ID, which Vercel provides automatically as `VERCEL_DEPLOYMENT_ID` (keep "Automatically expose System Environment Variables" on, the default). When an online screen sees a different ID from the one its page was loaded with, it reloads, so screens pick up a new deploy within about one playlist check (~10 minutes). It reloads at most once per new release (the 6 hour reload described in [Offline](offline.md) is the fallback if that doesn't take). Locally the ID is `dev` and no auto-reload happens.

## PiSignage Web Link

1. In the PiSignage server, Assets, Add a **Web Link** with your Vercel URL (for example `https://your-project.vercel.app/`).
2. Add it to a playlist (or a playlist's zone) with a long duration, or as the only asset, so the player stays on it.
3. Assign the playlist to the group or player and deploy.

[← Back to the README](../README.md)
