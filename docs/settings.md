# Settings and the Drive `config.json` override

Behavior defaults are in `slideshow.config.json` (no IDs or URLs). To change them without redeploying, put a file named exactly `config.json` in the **root** of the Drive folder. A ready-to-copy template with every setting Drive can change, at its default value, is in [`docs/config.json`](config.json) (a test keeps it in sync with the defaults). It is never shown as a slide. Anything you leave out keeps its default; an invalid value is ignored (default used) and noted in the server log; invalid JSON ignores the whole file.

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

[← Back to the README](../README.md)
