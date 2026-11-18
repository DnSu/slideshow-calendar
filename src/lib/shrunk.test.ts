import { describe, expect, it } from "vitest";
import { formatBytes, shrunkIssue } from "@/lib/shrunk";

describe("shrunk pictures", () => {
  it("formats sizes for people", () => {
    expect(formatBytes(6_500_000)).toBe("6.2 MB");
    expect(formatBytes(480 * 1024)).toBe("480 KB");
    expect(formatBytes(10)).toBe("1 KB");
  });
  it("says what happened and what to do", () => {
    const i = shrunkIssue("poster.png", 6_500_000, 480 * 1024);
    expect(i.name).toBe("poster.png");
    expect(i.reason).toMatch(/^is 6\.2 MB, more than the screens need, so it's sent as 480 KB\. It still shows/);
  });
});
