import { describe, expect, it } from "vitest";
import { KNOWN_CODES, describeCode } from "@/lib/weatherCodes";
import { demoWeather } from "@/lib/demoWeather";
import { forecastUrl, geocodeUrl, parseForecast, parseGeocode } from "@/lib/weather";
import { weatherView } from "@/lib/weatherView";
import { weatherIconSvg } from "@/components/weather-icons/icons";
import type { PlaylistWeather } from "@/lib/types";

const good = {
  current: {
    temperature_2m: 54.1,
    apparent_temperature: 50.2,
    weather_code: 2,
    is_day: 1,
    wind_speed_10m: 8.4,
    relative_humidity_2m: 60,
  },
  daily: {
    time: ["2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14"],
    weather_code: [2, 3, 61, 0, 71],
    temperature_2m_max: [58, 57, 52, 55, 40],
    temperature_2m_min: [44, 45, 43, 41, 30],
    precipitation_probability_max: [10, 20, 80, null, 0],
  },
};

describe("parseForecast", () => {
  it("parses a good response", () => {
    const w = parseForecast(good, "fahrenheit", 1000)!;
    expect(w.fetchedAt).toBe(1000);
    expect(w.units).toBe("fahrenheit");
    expect(w.current).toEqual({ temp: 54.1, feelsLike: 50.2, code: 2, isDay: true, wind: 8.4, humidity: 60 });
    expect(w.days).toHaveLength(5);
    expect(w.days[2]).toEqual({ day: "2026-03-12", code: 61, high: 52, low: 43, rain: 80 });
    expect(w.days[3].rain).toBeNull();
  });
  it("drops days with missing values and keeps the rest", () => {
    const bad = structuredClone(good);
    bad.daily.temperature_2m_max[1] = null as unknown as number;
    bad.daily.time[4] = "not-a-day";
    expect(parseForecast(bad, "celsius", 1)!.days.map((d) => d.day)).toEqual(["2026-03-10", "2026-03-12", "2026-03-13"]);
  });
  it("tolerates missing optional parts", () => {
    const { current: _c, ...noCurrent } = good;
    void _c;
    expect(parseForecast(noCurrent, "fahrenheit", 1)!.current).toBeNull();
    const noRain = structuredClone(good) as Record<string, unknown>;
    delete (noRain.daily as Record<string, unknown>).precipitation_probability_max;
    expect(parseForecast(noRain, "fahrenheit", 1)!.days[0].rain).toBeNull();
  });
  it("loses only the current block when it is malformed", () => {
    const w = parseForecast({ ...good, current: { temperature_2m: "warm" } }, "fahrenheit", 1)!;
    expect(w.current).toBeNull();
    expect(w.days).toHaveLength(5);
  });
  it("returns null, never throws, for the wrong shape", () => {
    for (const j of [null, undefined, 5, "x", [], {}, { daily: {} }, { daily: { time: "x" } }, { error: true, reason: "nope" }]) {
      expect(parseForecast(j, "fahrenheit", 1)).toBeNull();
    }
    expect(parseForecast({ daily: { ...good.daily, time: [] } }, "fahrenheit", 1)).toBeNull();
  });
});

describe("request URLs", () => {
  it("asks for 5 days in the right units and timezone", () => {
    const u = new URL(forecastUrl(40, -75, "America/New_York", "fahrenheit"));
    expect(u.hostname).toBe("api.open-meteo.com");
    expect(u.searchParams.get("temperature_unit")).toBe("fahrenheit");
    expect(u.searchParams.get("wind_speed_unit")).toBe("mph");
    expect(u.searchParams.get("timezone")).toBe("America/New_York");
    expect(u.searchParams.get("forecast_days")).toBe("5");
    expect(new URL(forecastUrl(40, -75, "UTC", "celsius")).searchParams.get("wind_speed_unit")).toBe("kmh");
  });
  it("builds the geocoding URL", () => {
    const u = new URL(geocodeUrl("00000", "US"));
    expect(u.searchParams.get("name")).toBe("00000");
    expect(u.searchParams.get("countryCode")).toBe("US");
    expect(u.searchParams.get("count")).toBe("1");
  });
});

describe("parseGeocode", () => {
  it("takes the first result", () => {
    expect(parseGeocode({ results: [{ latitude: 40.1, longitude: -75.2, name: "x" }, { latitude: 1, longitude: 2 }] })).toEqual({
      latitude: 40.1,
      longitude: -75.2,
    });
  });
  it("is null for no results or a wrong shape", () => {
    expect(parseGeocode({ generationtime_ms: 0.4 })).toBeNull();
    expect(parseGeocode({ results: [] })).toBeNull();
    expect(parseGeocode({ results: [{ latitude: "40", longitude: -75 }] })).toBeNull();
    expect(parseGeocode({ results: [{ latitude: 140, longitude: -75 }] })).toBeNull();
    expect(parseGeocode(null)).toBeNull();
    expect(parseGeocode("nope")).toBeNull();
  });
});

describe("describeCode", () => {
  it("maps every documented code to an icon that exists", () => {
    for (const code of KNOWN_CODES) {
      for (const isDay of [true, false]) {
        const info = describeCode(code, isDay);
        expect(info.label).toBeTruthy();
        expect(weatherIconSvg[info.icon]).toBeTruthy();
      }
    }
  });
  it("uses day and night variants", () => {
    expect(describeCode(0, true).icon).toBe("clear-day");
    expect(describeCode(0, false).icon).toBe("clear-night");
    expect(describeCode(2, false).icon).toBe("partly-cloudy-night");
    expect(describeCode(61, false).icon).toBe("rain");
  });
  it("falls back for unknown codes", () => {
    expect(describeCode(1234).icon).toBe("cloudy");
    expect(describeCode(-1, false).label).toBeTruthy();
  });
});

describe("weatherView", () => {
  const w = parseForecast(good, "fahrenheit", Date.parse("2026-03-10T15:00:00Z")) as PlaylistWeather;
  const at = (iso: string) => Date.parse(iso);
  it("shows today and the next four days, with current conditions", () => {
    const v = weatherView(w, at("2026-03-10T16:00:00Z"), "UTC")!;
    expect(v.today.day).toBe("2026-03-10");
    expect(v.next.map((d) => d.day)).toEqual(["2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14"]);
    expect(v.current?.temp).toBe(54.1);
  });
  it("hides current conditions after 3 hours", () => {
    expect(weatherView(w, at("2026-03-10T18:00:00Z"), "UTC")!.current).not.toBeNull();
    expect(weatherView(w, at("2026-03-10T18:00:01Z"), "UTC")!.current).toBeNull();
    expect(weatherView(w, at("2026-03-10T18:00:01Z"), "UTC")!.today.high).toBe(58);
  });
  it("moves days by the date in the timezone across midnight", () => {
    // 23:30 UTC on the 10th is already the 11th in Tokyo.
    expect(weatherView(w, at("2026-03-10T23:30:00Z"), "UTC")!.today.day).toBe("2026-03-10");
    const tokyo = weatherView(w, at("2026-03-10T16:00:00Z"), "Asia/Tokyo")!;
    expect(tokyo.today.day).toBe("2026-03-11");
    expect(tokyo.next).toHaveLength(3);
  });
  it("offline and stale: past days drop off, current is hidden, then the slide is skipped", () => {
    const v = weatherView(w, at("2026-03-12T09:00:00Z"), "UTC")!;
    expect(v.today.day).toBe("2026-03-12");
    expect(v.current).toBeNull();
    expect(v.next).toHaveLength(2);
    expect(weatherView(w, at("2026-03-13T09:00:00Z"), "UTC")!.next).toHaveLength(1);
    expect(weatherView(w, at("2026-03-14T09:00:00Z"), "UTC")).toBeNull();
    expect(weatherView(w, at("2026-04-01T09:00:00Z"), "UTC")).toBeNull();
  });
  it("is null without a forecast", () => {
    expect(weatherView(null, 0, "UTC")).toBeNull();
    expect(weatherView(undefined, 0, "UTC")).toBeNull();
  });
});

describe("demoWeather", () => {
  it("gives 5 days starting today with varied icons", () => {
    const now = Date.parse("2026-03-10T15:00:00Z");
    const icons = new Set<string>();
    for (let v = 0; v < 4; v++) {
      const d = demoWeather(now, "UTC", "fahrenheit", v);
      expect(d.days.map((x) => x.day)[0]).toBe("2026-03-10");
      expect(d.days).toHaveLength(5);
      d.days.forEach((x) => icons.add(describeCode(x.code).icon));
    }
    expect(icons.size).toBeGreaterThan(8);
    expect(weatherView(demoWeather(now, "UTC", "celsius"), now, "UTC")).not.toBeNull();
  });
});
