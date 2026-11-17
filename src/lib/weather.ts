import { z } from "zod";
import type { Day } from "./dates";
import { isValidDay } from "./dates";
import type { PlaylistWeather, WeatherCurrent, WeatherDay, WeatherUnits } from "./types";

const TIMEOUT_MS = 20_000;

export function forecastUrl(latitude: number, longitude: number, timezone: string, units: WeatherUnits): string {
  const q = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    temperature_unit: units,
    wind_speed_unit: units === "fahrenheit" ? "mph" : "kmh",
    timezone,
    forecast_days: "5",
  });
  return `https://api.open-meteo.com/v1/forecast?${q.toString().replaceAll("%2C", ",")}`;
}

const num = z.number().finite();
const maybeNum = z.number().finite().nullish();

const forecastSchema = z.object({
  current: z
    .object({
      temperature_2m: num,
      apparent_temperature: maybeNum,
      weather_code: num,
      is_day: z.union([z.literal(0), z.literal(1)]),
      wind_speed_10m: maybeNum,
      relative_humidity_2m: maybeNum,
    })
    .optional(),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(num.nullable()),
    temperature_2m_max: z.array(num.nullable()),
    temperature_2m_min: z.array(num.nullable()),
    precipitation_probability_max: z.array(maybeNum).optional(),
  }),
});

/**
 * Turn an Open-Meteo forecast response into our shape. Returns null for anything unusable
 * (wrong shape, no complete day). Days with missing values are dropped; a bad `current`
 * block only loses the current conditions. Never throws.
 */
export function parseForecast(json: unknown, units: WeatherUnits, fetchedAt: number): PlaylistWeather | null {
  const r = forecastSchema.safeParse(json);
  if (!r.success) {
    // `current` is optional but if it is malformed, retry without it.
    if (typeof json === "object" && json !== null && "current" in json) {
      const { current: _ignored, ...rest } = json as Record<string, unknown>;
      void _ignored;
      return parseForecast(rest, units, fetchedAt);
    }
    return null;
  }
  const { current, daily } = r.data;
  const days: WeatherDay[] = [];
  daily.time.forEach((day: Day, i) => {
    const code = daily.weather_code[i];
    const high = daily.temperature_2m_max[i];
    const low = daily.temperature_2m_min[i];
    if (!isValidDay(day) || code == null || high == null || low == null) return;
    const rain = daily.precipitation_probability_max?.[i];
    days.push({ day, code, high, low, rain: rain == null ? null : rain });
  });
  if (days.length === 0) return null;
  const now: WeatherCurrent | null = current
    ? {
        temp: current.temperature_2m,
        feelsLike: current.apparent_temperature ?? null,
        code: current.weather_code,
        isDay: current.is_day === 1,
        wind: current.wind_speed_10m ?? null,
        humidity: current.relative_humidity_2m ?? null,
      }
    : null;
  return { fetchedAt, units, current: now, days };
}

/** Fetch the 5-day forecast. Throws on network failure or an unusable response. */
export async function fetchForecast(
  latitude: number,
  longitude: number,
  timezone: string,
  units: WeatherUnits,
): Promise<PlaylistWeather> {
  const res = await fetch(forecastUrl(latitude, longitude, timezone, units), {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching forecast`);
  const weather = parseForecast(await res.json(), units, Date.now());
  if (!weather) throw new Error("forecast response not recognised");
  return weather;
}

const geocodeSchema = z.object({
  results: z.array(z.object({ latitude: num.min(-90).max(90), longitude: num.min(-180).max(180) })).min(1),
});

export function geocodeUrl(zip: string, country: string): string {
  const q = new URLSearchParams({ name: zip, count: "1", countryCode: country, language: "en", format: "json" });
  return `https://geocoding-api.open-meteo.com/v1/search?${q}`;
}

/** First match of an Open-Meteo geocoding response, or null (no results or wrong shape). */
export function parseGeocode(json: unknown): { latitude: number; longitude: number } | null {
  const r = geocodeSchema.safeParse(json);
  if (!r.success) return null;
  const { latitude, longitude } = r.data.results[0];
  return { latitude, longitude };
}

/** Resolve a ZIP / postal code to coordinates. Throws when the lookup fails or finds nothing. */
export async function fetchGeocode(zip: string, country: string): Promise<{ latitude: number; longitude: number }> {
  const res = await fetch(geocodeUrl(zip, country), { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} looking up the weather location`);
  const place = parseGeocode(await res.json());
  if (!place) throw new Error("weather location not found for WEATHER_ZIP / WEATHER_COUNTRY");
  return place;
}
