import { describe, expect, it } from "vitest";
import { describeCode } from "@/lib/weatherCodes";
import { demoWeather } from "@/lib/demoWeather";
import { weatherView } from "@/lib/weatherView";

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
    expect(
      weatherView(demoWeather(now, "UTC", "celsius"), now, "UTC"),
    ).not.toBeNull();
  });
});
