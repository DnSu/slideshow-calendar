# Settings and the Drive settings Doc

Behavior defaults are in `slideshow.config.json` (no IDs or URLs). To change them without redeploying, put a **Google Doc named `config`** in the **root** of the Drive folder, one `NAME = value` per line. [`docs/config.txt`](config.txt) is the template to paste into it: every setting Drive can change, at its default, with a note on each (a test keeps it equal to the defaults). The Doc is never shown as a slide.

```
# How long each picture stays on screen, in seconds.
PICTURE_SECONDS = 15
PICTURE_FIT = contain
SHOW_WEATHER = no
TIMEZONE = America/Chicago
```

The format is forgiving, because people edit it in Google Docs: names ignore case and spaces/underscores; values need no quotes (straight or curly quotes are removed); on/off settings take yes/no (or true/false, on/off); numbers may have units after them ("20 seconds") and thousands commas; lines starting with `#` or `//` are notes. A mistake loses only its own line (that setting keeps its default). Anything left out keeps its default.

The server reads the Doc through its public plain-text export link (no sign-in, since the folder is shared by link). It also accepts a `config.txt` file in the same format, and the older `config.json` (JSON with the nested names in the table below); if more than one exists it uses the Doc, then `config.txt`, then `config.json`, and flags the rest. Text that starts with `{` is read as JSON wherever it comes from.

The `/slideshow` preview lists mistakes, settings the file doesn't have, and leftover files, with a **Copy fixed settings** button that copies a complete Doc keeping the valid values (see [Previews](previews.md)). A `config.json` gets a note suggesting the switch to the Doc.

| Setting (`config.json` name) | In the Doc | Meaning | Drive can change? |
|---|---|---|---|
| `DRIVE_FOLDER_ID`, `CALENDAR_ID` | | which folder and calendar | No (environment only) |
| `refresh.sourceMinutes` |  | how often the server reads Google | No |
| `timezone` | `TIMEZONE` | overrides `TIMEZONE` | Yes |
| `slideshow.imageSeconds` | `PICTURE_SECONDS` | seconds per image | Yes |
| `slideshow.imageFit` | `PICTURE_FIT` | `cover` (default: fill the screen, crops edges) or `contain` (whole image, black bars) | Yes |
| `slideshow.transitionMs` | `FADE_SECONDS` (seconds) | cross-fade length | Yes |
| `calendar.showAfterImages` | `CALENDAR_AFTER_PICTURES` | images between calendar pages | Yes |
| `calendar.displaySeconds` | `CALENDAR_SECONDS` | seconds for the calendar page | Yes |
| `calendar.fetchDays` | `CALENDAR_DAYS_AHEAD` | how far ahead (days) to look for events; all of them are shown | Yes |
| `calendar.eventsPerPage` | `EVENTS_PER_PAGE` | events per calendar page; more events → more pages, one page per calendar turn | Yes |
| `calendar.title` | `CALENDAR_TITLE` | page heading | Yes |
| `refresh.playlistMinutes` | `CHECK_FOR_CHANGES_MINUTES` | how often the screen asks for updates | Yes |
| `refresh.pageReloadHours` | `RESTART_PAGE_HOURS` | full page reload interval | Yes |
| `offline.showIndicator` | `SHOW_OFFLINE_DOT` | show the offline dot | Yes |
| `weather.enabled` | `SHOW_WEATHER` | show the weather slide (needs a location in the environment) | Yes |
| `weather.units` | `WEATHER_UNITS` | `fahrenheit` (default) or `celsius`; wind follows (mph or km/h) | Yes |
| `weather.displaySeconds` | `WEATHER_SECONDS` | seconds for the weather slide (15) | Yes |
| `weather.title` | `WEATHER_TITLE` | slide heading | Yes |
| `holidays.daysBefore` | `HOLIDAY_DAYS_BEFORE` | days before a holiday its pictures start showing (7) | Yes |
| `holidays.daysAfter` | `HOLIDAY_DAYS_AFTER` | days after a holiday they keep showing (1) | Yes |
| `WEATHER_ZIP`, `WEATHER_COUNTRY`, `WEATHER_LATITUDE`, `WEATHER_LONGITUDE` | | weather location | No (environment only) |

[← Back to the README](../README.md)
