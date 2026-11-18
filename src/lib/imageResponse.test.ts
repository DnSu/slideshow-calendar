import { describe, expect, it } from "vitest";
import { imageHeaders, rasterType } from "@/lib/imageResponse";

describe("rasterType", () => {
  it("passes plain raster pictures, normalised", () => {
    expect(rasterType("image/png")).toBe("image/png");
    expect(rasterType("Image/JPEG; charset=binary")).toBe("image/jpeg");
    expect(rasterType("image/webp")).toBe("image/webp");
  });
  it("refuses SVG, HTML and anything else", () => {
    expect(rasterType("image/svg+xml")).toBeNull();
    expect(rasterType("text/html; charset=utf-8")).toBeNull();
    expect(rasterType("application/octet-stream")).toBeNull();
    expect(rasterType("")).toBeNull();
    expect(rasterType(null)).toBeNull();
  });
});

describe("imageHeaders", () => {
  it("turns off sniffing and anything active", () => {
    const h = imageHeaders("image/png");
    expect(h["Content-Type"]).toBe("image/png");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Content-Security-Policy"]).toContain("sandbox");
  });
});
