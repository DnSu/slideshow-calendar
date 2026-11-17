import type { CoreSettings } from "@/lib/config";
import type { PlaylistWeather } from "@/lib/types";
import { describeCode } from "@/lib/weatherCodes";
import { weatherView } from "@/lib/weatherView";
import WeatherIcon from "./WeatherIcon";

type Props = {
  weather: PlaylistWeather;
  nowMs: number;
  timezone: string;
  settings: CoreSettings["weather"];
};

const deg = (n: number) => `${Math.round(n)}°`;

function dayParts(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...o }).format(date);
  return { short: fmt({ weekday: "short" }), long: fmt({ weekday: "long", month: "long", day: "numeric" }) };
}

export default function WeatherSlide({ weather, nowMs, timezone, settings }: Props) {
  const view = weatherView(weather, nowMs, timezone);
  if (!view) return null;
  const { today, next, current } = view;
  const info = describeCode(current?.code ?? today.code, current ? current.isDay : true);
  const mph = weather.units === "fahrenheit" ? "mph" : "km/h";
  const updated = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(
    weather.fetchedAt,
  );
  const details = [
    today.rain !== null ? `Rain ${Math.round(today.rain)}%` : null,
    current?.wind != null ? `Wind ${Math.round(current.wind)} ${mph}` : null,
  ].filter(Boolean);

  return (
    <div className="weather">
      <header className="weather-header">
        <h1>{settings.title}</h1>
        <div className="weather-date">{dayParts(today.day).long}</div>
      </header>

      <section className="weather-today">
        <WeatherIcon name={info.icon} className="weather-today-icon" />
        <div className="weather-temp">{current ? deg(current.temp) : deg(today.high)}</div>
        <div className="weather-condition">{info.label}</div>
        <div className="weather-detail weather-detail-row">
          {current?.feelsLike != null && <span>Feels like {deg(current.feelsLike)}</span>}
          <span>H {deg(today.high)}</span>
          <span>L {deg(today.low)}</span>
        </div>
        {details.length > 0 && <div className="weather-detail">{details.join(" · ")}</div>}
      </section>

      <ul className="weather-days">
        {next.map((d) => (
          <li key={d.day}>
            <span className="weather-day-name">{dayParts(d.day).short}</span>
            <WeatherIcon name={describeCode(d.code).icon} className="weather-day-icon" />
            <span className="weather-day-rain">{d.rain !== null ? `${Math.round(d.rain)}%` : ""}</span>
            <span className="weather-day-temps">
              {deg(d.high)} <span className="weather-day-low">/ {deg(d.low)}</span>
            </span>
          </li>
        ))}
      </ul>

      <footer className="weather-footer">
        Updated {updated} · Weather: Open-Meteo.com · Icons: Meteocons
      </footer>
    </div>
  );
}
