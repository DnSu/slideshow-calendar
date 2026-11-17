import { describe, expect, it } from "vitest";
import { KNOWN_CODES, describeCode } from "@/lib/weatherCodes";
import { weatherIconSvg } from "@/components/weather-icons/icons";

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
