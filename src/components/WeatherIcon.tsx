import { weatherIconSvg, type WeatherIconName } from "./weather-icons/icons";

/** A Meteocons icon drawn inline (so currentColor works and nothing is fetched). Size it with CSS. */
export default function WeatherIcon({
  name,
  className,
}: {
  name: WeatherIconName;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 128 128"
      fill="none"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: weatherIconSvg[name] }}
    />
  );
}
