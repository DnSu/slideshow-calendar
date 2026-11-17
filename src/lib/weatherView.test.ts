import { describe, expect, it } from "vitest";
import { parseForecast } from "@/lib/weather";
import { weatherView } from "@/lib/weatherView";
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

describe("weatherView", () => {
  const w = parseForecast(
    good,
    "fahrenheit",
    Date.parse("2026-03-10T15:00:00Z"),
  ) as PlaylistWeather;
  const at = (iso: string) => Date.parse(iso);
  it("shows today and the next four days, with current conditions", () => {
    const v = weatherView(w, at("2026-03-10T16:00:00Z"), "UTC")!;
    expect(v.today.day).toBe("2026-03-10");
    expect(v.next.map((d) => d.day)).toEqual([
      "2026-03-11",
      "2026-03-12",
      "2026-03-13",
      "2026-03-14",
    ]);
    expect(v.current?.temp).toBe(54.1);
  });
  it("hides current conditions after 3 hours", () => {
    expect(
      weatherView(w, at("2026-03-10T18:00:00Z"), "UTC")!.current,
    ).not.toBeNull();
    expect(
      weatherView(w, at("2026-03-10T18:00:01Z"), "UTC")!.current,
    ).toBeNull();
    expect(weatherView(w, at("2026-03-10T18:00:01Z"), "UTC")!.today.high).toBe(
      58,
    );
  });
  it("moves days by the date in the timezone across midnight", () => {
    // 23:30 UTC on the 10th is already the 11th in Tokyo.
    expect(weatherView(w, at("2026-03-10T23:30:00Z"), "UTC")!.today.day).toBe(
      "2026-03-10",
    );
    const tokyo = weatherView(w, at("2026-03-10T16:00:00Z"), "Asia/Tokyo")!;
    expect(tokyo.today.day).toBe("2026-03-11");
    expect(tokyo.next).toHaveLength(3);
  });
  it("offline and stale: past days drop off, current is hidden, then the slide is skipped", () => {
    const v = weatherView(w, at("2026-03-12T09:00:00Z"), "UTC")!;
    expect(v.today.day).toBe("2026-03-12");
    expect(v.current).toBeNull();
    expect(v.next).toHaveLength(2);
    expect(
      weatherView(w, at("2026-03-13T09:00:00Z"), "UTC")!.next,
    ).toHaveLength(1);
    expect(weatherView(w, at("2026-03-14T09:00:00Z"), "UTC")).toBeNull();
    expect(weatherView(w, at("2026-04-01T09:00:00Z"), "UTC")).toBeNull();
  });
  it("is null without a forecast", () => {
    expect(weatherView(null, 0, "UTC")).toBeNull();
    expect(weatherView(undefined, 0, "UTC")).toBeNull();
  });
});
