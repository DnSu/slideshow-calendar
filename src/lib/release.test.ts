import { afterEach, describe, expect, it, vi } from "vitest";
import { currentRelease, shouldReloadForRelease } from "@/lib/release";

const ok = { online: true, fromCache: false, alreadyTried: false };

describe("currentRelease", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("reads Vercel's deployment ID, or 'dev'", () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "");
    expect(currentRelease()).toBe("dev");
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_fake123");
    expect(currentRelease()).toBe("dpl_fake123");
  });
});

describe("shouldReloadForRelease", () => {
  it("reloads when a live response has a new release", () => {
    expect(shouldReloadForRelease("a", "b", ok)).toBe(true);
  });
  it("does nothing when the release is the same or unknown", () => {
    expect(shouldReloadForRelease("a", "a", ok)).toBe(false);
    expect(shouldReloadForRelease(null, "b", ok)).toBe(false);
    expect(shouldReloadForRelease("a", undefined, ok)).toBe(false);
  });
  it("never reloads for dev", () => {
    expect(shouldReloadForRelease("dev", "b", ok)).toBe(false);
    expect(shouldReloadForRelease("a", "dev", ok)).toBe(false);
  });
  it("never reloads offline or from a saved copy", () => {
    expect(shouldReloadForRelease("a", "b", { ...ok, online: false })).toBe(
      false,
    );
    expect(shouldReloadForRelease("a", "b", { ...ok, fromCache: true })).toBe(
      false,
    );
  });
  it("does not reload twice for the same release", () => {
    expect(
      shouldReloadForRelease("a", "b", { ...ok, alreadyTried: true }),
    ).toBe(false);
  });
});
