# Developer previews (`/slideshow`, `/calendar`, `/weather`)

The signage screen runs at `/`. Three preview pages share a menu at the top for switching between them. On a phone the menu folds into a ☰ button. It also has a **Sample data** toggle (made-up events and a made-up forecast, handy while the real ones are empty; same as adding `?demo`) and a link that opens the real screen. Each page shows a portrait **9:16** frame sized to the browser window, with controls below it. The content is scaled to the frame. None is linked from the screen, and all are marked `noindex`.

**`/slideshow`** shows the same images, calendar pages, fit and weather as the screen, in a simpler loop: every active image once (in playlist order), then each calendar page once (if there are events), then the weather (if there is a forecast), then back to the first image. This is shorter than the real screen's order, where the calendar and weather come after every `showAfterImages` images.

- **It never advances on its own.** Use the **‹** / **›** arrows (or the ← / → keys); ‹ wraps from the first slide to the last, and › from the last to the first. **Restart**, in the **⋮** menu, goes back to slide 1.
- **Refresh** (the ⟳ button, which spins while it works) makes the server read Drive, the calendar and the weather again right away, instead of waiting for its hourly refresh, then shows the new copy. Use it after adding, replacing or removing pictures. Screens get the fresh copy at their next playlist check (within `refresh.playlistMinutes`, 10 by default). The server accepts it at most every 30 seconds.
- **All images**, in the **⋮** menu, switches what the loop includes. Off (the default), it shows only the images on screen today. On, it adds every-year folders outside their dates and folders whose dates haven't started yet, so you can check upcoming pictures; the line below the buttons marks those as "not on screen now". Folders that have ended are never included.
- **Problems in Drive.** When something in the Drive folder won't show, a box under the controls lists it in plain words: folder names it doesn't understand (with why, e.g. "ends before it starts"), dated or holiday folders with no pictures, files that aren't pictures (PDFs, videos, Google Docs/Slides, Office files, shortcuts, HEIC), pictures put straight into "Holidays", folders inside folders, pictures the server had to make smaller because they were bigger than the screens need (they still show), and mistakes in the settings (the `config` Google Doc, or an old `config.json`): bad lines or values, unknown settings, settings it lacks, and more than one settings file. In the main folder only pictures, the settings file and `HOW-TO-USE-THIS-FOLDER.txt` are expected; inside other folders, only pictures. **Copy fixed settings** copies a complete settings Doc that keeps the valid values and fills in the rest with the current defaults. The checks run when the server reads Drive, so press ⟳ after fixing things.
- The line between the buttons shows the position ("Slide 2 of 6", counting images, calendar pages and weather), when the image shows, in words such as "every year Jun 25th to Jul 5th" or "until Dec 31st, 2026" (or the calendar page, or weather), and how long it stays up on the real screen.

**`/calendar`** shows only the calendar, drawn the way the screen draws it.

- Pages rotate on the same `displaySeconds` timing as the screen. **Pause** stops the rotation, and the **‹** / **›** arrows (or ← / →) step through pages.
- `/calendar?page=2` opens paused on page 2.

**`/weather`** shows only the weather slide, in the same frame. The **⟳** button fetches the forecast again; the line below says when it was updated, or why it is hidden. With sample data, the **‹** / **›** arrows switch between four made-up forecasts that together use every icon.

[← Back to the README](../README.md)
