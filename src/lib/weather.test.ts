import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchForecast,
  fetchGeocode,
  forecastUrl,
  geocodeUrl,
  parseForecast,
  parseGeocode,
} from "@/lib/weather";

const respond = (body: string | object, status = 200) =>
  vi.fn(
    async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
      }),
  );

afterEach(() => vi.unstubAllGlobals());

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
    time: [
      "2026-03-10",
      "2026-03-11",
      "2026-03-12",
      "2026-03-13",
      "2026-03-14",
    ],
    weather_code: [2, 3, 61, 0, 71],
    temperature_2m_max: [58, 57, 52, 55, 40],
    temperature_2m_min: [44, 45, 43, 41, 30],
    precipitation_probability_max: [10, 20, 80, null, 0],
  },
};

describe("weather requests", () => {
  it("geocodes a ZIP to coordinates", async () => {
    vi.stubGlobal(
      "fetch",
      respond({
        results: [{ latitude: 40.1, longitude: -75.2, name: "Faketown" }],
      }),
    );
    await expect(fetchGeocode("00000", "US")).resolves.toEqual({
      latitude: 40.1,
      longitude: -75.2,
    });
  });
  it("throws when the ZIP isn't found or the service fails", async () => {
    vi.stubGlobal("fetch", respond({ generationtime_ms: 0.1 }));
    await expect(fetchGeocode("00000", "US")).rejects.toThrow("not found");
    vi.stubGlobal("fetch", respond("", 503));
    await expect(fetchGeocode("00000", "US")).rejects.toThrow("HTTP 503");
  });
  it("throws on a failed or unrecognised forecast", async () => {
    vi.stubGlobal("fetch", respond("", 500));
    await expect(fetchForecast(40, -75, "UTC", "fahrenheit")).rejects.toThrow(
      "HTTP 500",
    );
    vi.stubGlobal("fetch", respond({ error: true, reason: "bad" }));
    await expect(fetchForecast(40, -75, "UTC", "fahrenheit")).rejects.toThrow(
      "not recognised",
    );
  });
});

describe("parseForecast", () => {
  it("parses a good response", () => {
    const w = parseForecast(good, "fahrenheit", 1000)!;
    expect(w.fetchedAt).toBe(1000);
    expect(w.units).toBe("fahrenheit");
    expect(w.current).toEqual({
      temp: 54.1,
      feelsLike: 50.2,
      code: 2,
      isDay: true,
      wind: 8.4,
      humidity: 60,
    });
    expect(w.days).toHaveLength(5);
    expect(w.days[2]).toEqual({
      day: "2026-03-12",
      code: 61,
      high: 52,
      low: 43,
      rain: 80,
    });
    expect(w.days[3].rain).toBeNull();
  });
  it("drops days with missing values and keeps the rest", () => {
    const bad = structuredClone(good);
    bad.daily.temperature_2m_max[1] = null as unknown as number;
    bad.daily.time[4] = "not-a-day";
    expect(parseForecast(bad, "celsius", 1)!.days.map((d) => d.day)).toEqual([
      "2026-03-10",
      "2026-03-12",
      "2026-03-13",
    ]);
  });
  it("tolerates missing optional parts", () => {
    const { current: _c, ...noCurrent } = good;
    void _c;
    expect(parseForecast(noCurrent, "fahrenheit", 1)!.current).toBeNull();
    const noRain = structuredClone(good) as Record<string, unknown>;
    delete (noRain.daily as Record<string, unknown>)
      .precipitation_probability_max;
    expect(parseForecast(noRain, "fahrenheit", 1)!.days[0].rain).toBeNull();
  });
  it("loses only the current block when it is malformed", () => {
    const w = parseForecast(
      { ...good, current: { temperature_2m: "warm" } },
      "fahrenheit",
      1,
    )!;
    expect(w.current).toBeNull();
    expect(w.days).toHaveLength(5);
  });
  it("returns null, never throws, for the wrong shape", () => {
    for (const j of [
      null,
      undefined,
      5,
      "x",
      [],
      {},
      { daily: {} },
      { daily: { time: "x" } },
      { error: true, reason: "nope" },
    ]) {
      expect(parseForecast(j, "fahrenheit", 1)).toBeNull();
    }
    expect(
      parseForecast({ daily: { ...good.daily, time: [] } }, "fahrenheit", 1),
    ).toBeNull();
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
    expect(
      new URL(forecastUrl(40, -75, "UTC", "celsius")).searchParams.get(
        "wind_speed_unit",
      ),
    ).toBe("kmh");
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
    expect(
      parseGeocode({
        results: [
          { latitude: 40.1, longitude: -75.2, name: "x" },
          { latitude: 1, longitude: 2 },
        ],
      }),
    ).toEqual({
      latitude: 40.1,
      longitude: -75.2,
    });
  });
  it("is null for no results or a wrong shape", () => {
    expect(parseGeocode({ generationtime_ms: 0.4 })).toBeNull();
    expect(parseGeocode({ results: [] })).toBeNull();
    expect(
      parseGeocode({ results: [{ latitude: "40", longitude: -75 }] }),
    ).toBeNull();
    expect(
      parseGeocode({ results: [{ latitude: 140, longitude: -75 }] }),
    ).toBeNull();
    expect(parseGeocode(null)).toBeNull();
    expect(parseGeocode("nope")).toBeNull();
  });
});
