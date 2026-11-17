# Weather

The weather slide uses the free [Open-Meteo](https://open-meteo.com) forecast API (no key). Set where it is for, in environment variables only (they are deployment data and are never sent to the browser):

| Variable | Meaning |
|---|---|
| `WEATHER_ZIP` | Simplest: a ZIP / postal code. Looked up once with Open-Meteo's geocoding and cached for weeks. It gives the town's point, which is fine for weather. |
| `WEATHER_COUNTRY` | 2-letter country code for the ZIP; default `US` |
| `WEATHER_LATITUDE`, `WEATHER_LONGITUDE` | More exact. If both are set and valid they are used instead of the ZIP. |

With neither set (or an unknown ZIP), there is no weather slide; a failed lookup is noted in the server log. Settings (`weather.enabled`, `weather.units`, `weather.displaySeconds`, `weather.title`) are in [Settings](settings.md). The forecast is cached with the other sources (60 minutes), and the last good copy is kept on failure. Offline screens pick days by date, hide "current" conditions older than 3 hours, and skip the slide when fewer than 2 forecast days are left.

Open-Meteo is free for **non-commercial** use (data under CC BY 4.0, hence the credit on the slide); commercial use needs one of their paid plans.

## Credits

Weather data: [Open-Meteo.com](https://open-meteo.com) (CC BY 4.0). Icons: [Meteocons](https://github.com/basmilius/meteocons-poc) by Bas Milius (MIT), monochrome set, copied into `src/components/weather-icons/` with its license notice. To refresh them: `npm pack @meteocons/svg`, unpack it, and run `node scripts/import-meteocons.mjs <unpacked package dir>`. The script strips the animation, recolors to `currentColor` and prefixes ids; the package is not a dependency.

[← Back to the README](../README.md)
