# slideshow-calendar

Next.js app (Vercel) shown on PiSignage players as a Web Link: a full-screen slideshow from a public Google Drive folder, plus an upcoming-events page from a public Google Calendar. No Google API key. The initial design is in `plans/01-initial-build.md`.

## Plans (`plans/`)
- Name files `NN-short-name.md`, where `NN` is two digits, one higher than the last (`01-initial-build.md`, `02-...`).
- When a plan is finished, compact it in place: replace it with a short record of what was built, key decisions and why, and anything left open. Remove step lists and alternatives that were dropped.
- **Don't read or search `plans/` unless the user names a plan or asks about past plans.** The code is the source of truth. `.ignore` keeps `plans/` out of ripgrep and Grep results. Read a plan file directly when it's needed.

## This repo is public (open source on GitHub)
- **Never commit secrets or deployment data.** That includes real Drive folder IDs or URLs, calendar IDs or iCal feed URLs, Vercel project or team IDs, tokens, and personal names or emails.
- Deployment-specific values come only from environment variables (`DRIVE_FOLDER_ID`, `CALENDAR_ID`, `TIMEZONE`). Locally they live in `.env.local`, which is gitignored. Only `.env.example`, with placeholders, is committed.
- `slideshow.config.json` holds behavior defaults only, never IDs or URLs.
- Don't send the folder ID, calendar ID, or feed URL to the browser.
- Tests and fixtures use made-up IDs and fake sample data.
- Before committing, check the diff for anything that looks like a real ID, URL, or email.

## Environment
- Node 24.x, the newest Vercel supports (`.nvmrc`; `package.json` `engines.node` = `24.x`). Run `nvm use` first.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
