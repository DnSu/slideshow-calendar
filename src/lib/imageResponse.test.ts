import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { fitForScreen, imageHeaders, MAX_SIDE, PASS_THROUGH_BYTES, rasterType, SENT_HEADER, SHRUNK_HEADER } from "@/lib/imageResponse";

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
    expect(h[SHRUNK_HEADER]).toBeUndefined();
  });
  it("says when a picture was made smaller", () => {
    const h = imageHeaders("image/webp", { from: 6_000_000, to: 500_000 });
    expect(h[SHRUNK_HEADER]).toBe("6000000");
    expect(h[SENT_HEADER]).toBe("500000");
  });
});

// Random noise doesn't compress, so it makes big files from small dimensions.
const noise = (width: number, height: number, alpha = false) =>
  sharp({
    create: {
      width,
      height,
      channels: alpha ? 4 : 3,
      background: { r: 0, g: 0, b: 0, alpha: 0.5 },
      noise: { type: "gaussian", mean: 128, sigma: 40 },
    },
  });
const flat = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 20, g: 120, b: 200 } } });

describe("fitForScreen", () => {
  it("passes a picture that already fits through untouched, byte for byte", async () => {
    const png = new Uint8Array(await flat(1080, 1920).png().toBuffer());
    const out = await fitForScreen(png, "image/png");
    expect(out.body).toBe(png);
    expect(out.type).toBe("image/png");
    expect(out.shrunkFrom).toBeUndefined();
  });

  it("fits a too-large picture inside the screen size, as WebP", async () => {
    const big = new Uint8Array(await flat(1920, 2880).png().toBuffer());
    const out = await fitForScreen(big, "image/png");
    expect(out.type).toBe("image/webp");
    expect(out.shrunkFrom).toBe(big.length);
    const meta = await sharp(out.body).metadata();
    expect([meta.width, meta.height]).toEqual([1280, MAX_SIDE]);
  });

  it("makes a heavy picture of the right size much smaller, keeping its size and transparency", async () => {
    const heavy = new Uint8Array(await noise(1080, 1920, true).png().toBuffer());
    expect(heavy.length).toBeGreaterThan(PASS_THROUGH_BYTES);
    const out = await fitForScreen(heavy, "image/png");
    expect(out.type).toBe("image/webp");
    expect(out.body.length).toBeLessThan(heavy.length);
    expect(out.body.length).toBeLessThan(4 * 1024 * 1024);
    const meta = await sharp(out.body).metadata();
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([1080, 1920, true]);
  });

  it("never enlarges", async () => {
    const small = new Uint8Array(await noise(400, 300).png().toBuffer());
    const out = await fitForScreen(small, "image/png");
    expect(out.body).toBe(small);
  });
});
