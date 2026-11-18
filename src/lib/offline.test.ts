import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { imageUrl, preloadImage } from "@/lib/offline";

describe("imageUrl", () => {
  it("adds the version so a replaced file gets a new URL", () => {
    expect(imageUrl("abc")).toBe("/api/image/abc");
    expect(imageUrl("abc", "1x2y")).toBe("/api/image/abc?v=1x2y");
    expect(imageUrl("abc", "1x2y")).not.toBe(imageUrl("abc", "9z"));
  });
});

describe("preloadImage", () => {
  class FakeImage {
    static last: FakeImage;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = "";
    removed = false;
    constructor() {
      FakeImage.last = this;
    }
    removeAttribute(name: string) {
      if (name === "src") this.removed = true;
    }
  }
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("Image", FakeImage);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("resolves true on load and lets go of its handlers", async () => {
    const p = preloadImage("/api/image/fakeImageId000000001");
    const img = FakeImage.last;
    img.onload!();
    expect(await p).toBe(true);
    expect(img.onload).toBeNull();
    expect(img.removed).toBe(false);
  });

  it("gives up after the timeout and cancels the download", async () => {
    const p = preloadImage("/api/image/fakeImageId000000002", 1000);
    const img = FakeImage.last;
    vi.advanceTimersByTime(1000);
    expect(await p).toBe(false);
    expect(img.onload).toBeNull();
    expect(img.onerror).toBeNull();
    expect(img.removed).toBe(true);
  });
});
