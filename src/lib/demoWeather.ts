import { addDays, dayInTz } from "./dates";
import type { PlaylistWeather, WeatherUnits } from "./types";

// Groups of five day codes; together they use every icon the slide can show.
const VARIANTS: { codes: number[]; isDay: boolean }[] = [
  { codes: [2, 3, 63, 2, 0], isDay: true },
  { codes: [71, 45, 95, 61, 1], isDay: true },
  { codes: [0, 56, 85, 51, 3], isDay: false },
  { codes: [95, 2, 45, 66, 75], isDay: false },
];

export const DEMO_WEATHER_VARIANTS = VARIANTS.length;

/** Made-up forecast for the /weather preview (`?demo`). `variant` picks a different mix of icons. */
export function demoWeather(nowMs: number, tz: string, units: WeatherUnits, variant = 0): PlaylistWeather {
  const { codes, isDay } = VARIANTS[((variant % VARIANTS.length) + VARIANTS.length) % VARIANTS.length];
  const today = dayInTz(nowMs, tz);
  const f = units === "fahrenheit";
  const t = (c: number) => Math.round(f ? (c * 9) / 5 + 32 : c);
  const highs = [14, 16, 11, 9, 18];
  const rain = [10, 20, 80, 30, 0];
  return {
    fetchedAt: nowMs,
    units,
    current: {
      temp: t(12.4),
      feelsLike: t(9.8),
      code: codes[0],
      isDay,
      wind: f ? 8 : 13,
      humidity: 58,
    },
    days: codes.map((code, i) => ({
      day: addDays(today, i),
      code,
      high: t(highs[i]),
      low: t(highs[i] - 7 - (i % 3)),
      rain: rain[(i + variant) % rain.length],
    })),
  };
}
