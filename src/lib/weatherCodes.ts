import type { WeatherIconName } from "@/components/weather-icons/icons";

export type CodeInfo = { icon: WeatherIconName; label: string };

const pick = (day: WeatherIconName, night: WeatherIconName, isDay: boolean) => (isDay ? day : night);

/** WMO weather code to an icon and a short label. Unknown codes get a neutral fallback. */
export function describeCode(code: number, isDay = true): CodeInfo {
  switch (code) {
    case 0:
      return { icon: pick("clear-day", "clear-night", isDay), label: "Clear" };
    case 1:
      return { icon: pick("clear-day", "clear-night", isDay), label: "Mostly clear" };
    case 2:
      return { icon: pick("partly-cloudy-day", "partly-cloudy-night", isDay), label: "Partly cloudy" };
    case 3:
      return { icon: pick("overcast-day", "overcast-night", isDay), label: "Overcast" };
    case 45:
    case 48:
      return { icon: pick("fog-day", "fog-night", isDay), label: "Fog" };
    case 51:
    case 53:
    case 55:
      return { icon: "drizzle", label: "Drizzle" };
    case 56:
    case 57:
      return { icon: "sleet", label: "Freezing drizzle" };
    case 61:
      return { icon: "rain", label: "Light rain" };
    case 63:
      return { icon: "rain", label: "Rain" };
    case 65:
      return { icon: "rain", label: "Heavy rain" };
    case 66:
    case 67:
      return { icon: "sleet", label: "Freezing rain" };
    case 71:
      return { icon: "snow", label: "Light snow" };
    case 73:
      return { icon: "snow", label: "Snow" };
    case 75:
      return { icon: "snow", label: "Heavy snow" };
    case 77:
      return { icon: "snow", label: "Snow grains" };
    case 80:
    case 81:
    case 82:
      return { icon: "rain", label: "Rain showers" };
    case 85:
    case 86:
      return { icon: "snow", label: "Snow showers" };
    case 95:
      return { icon: pick("thunderstorms-day", "thunderstorms-night", isDay), label: "Thunderstorm" };
    case 96:
    case 99:
      return { icon: pick("thunderstorms-day", "thunderstorms-night", isDay), label: "Thunderstorm, hail" };
    default:
      return { icon: "cloudy", label: "Cloudy" };
  }
}

/** Every code Open-Meteo documents (used by tests and the demo). */
export const KNOWN_CODES = [
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99,
] as const;
