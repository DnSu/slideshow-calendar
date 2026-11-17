# Developer previews (`/slideshow`, `/calendar`, `/weather`)

The signage screen runs at `/`. Three preview pages share a menu at the top for switching between them. The menu also has a **Sample data** toggle (made-up events and a made-up forecast, handy while the real ones are empty; same as adding `?demo`) and a link that opens the real screen. Each page shows a portrait **9:16** frame sized to the browser window, with controls below it. The content is scaled to the frame. None is linked from the screen, and all are marked `noindex`.

**`/slideshow`** shows the same images, calendar pages, fit and weather as the screen, in a simpler loop: every active image once (in playlist order), then each calendar page once (if there are events), then the weather (if there is a forecast), then back to the first image. This is shorter than the real screen's order, where the calendar and weather come after every `showAfterImages` images.

- **It never advances on its own.** Use **◀ Prev** / **Next ▶** (or the ← / → keys); Prev wraps from the first slide to the last, and Next from the last to the first. **Restart** goes back to slide 1.
- **Refresh** makes the server read Drive, the calendar and the weather again right away, instead of waiting for its hourly refresh, then shows the new copy. Use it after adding, replacing or removing pictures. Screens get the fresh copy at their next playlist check (within `refresh.playlistMinutes`, 10 by default). The server accepts it at most every 30 seconds.
- **Active now / All images** switches what the loop includes. **Active now** (the default) shows only the images on screen today. **All images** adds every-year folders outside their dates and folders whose dates haven't started yet, so you can check upcoming pictures; the line below the buttons marks those as "not on screen now". Folders that have ended are never included.
- The line between the buttons shows the position ("Slide 2 of 6", counting images, calendar pages and weather), when the image shows, in words such as "every year Jun 25th to Jul 5th" or "until Dec 31st, 2026" (or the calendar page, or weather), and how long it stays up on the real screen.

**`/calendar`** shows only the calendar, drawn the way the screen draws it.

- Pages rotate on the same `displaySeconds` timing as the screen. **Pause** stops the rotation, and **◀ Prev** / **Next ▶** (or ← / →) step through pages.
- `/calendar?page=2` opens paused on page 2.

**`/weather`** shows only the weather slide, in the same frame. **Reload** fetches the forecast again; the line below says when it was updated, or why it is hidden. With sample data, **◀ Prev** / **Next ▶** switch between four made-up forecasts that together use every icon.

[← Back to the README](../README.md)
