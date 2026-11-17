import { describe, expect, it } from "vitest";
import { imageUrl } from "@/lib/offline";

describe("imageUrl", () => {
  it("adds the version so a replaced file gets a new URL", () => {
    expect(imageUrl("abc")).toBe("/api/image/abc");
    expect(imageUrl("abc", "1x2y")).toBe("/api/image/abc?v=1x2y");
    expect(imageUrl("abc", "1x2y")).not.toBe(imageUrl("abc", "9z"));
  });
});
