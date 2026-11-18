"use client";

import { useEffect, useState } from "react";
import { imageUrl } from "@/lib/offline";
import { SENT_HEADER, SHRUNK_HEADER, shrunkIssue } from "@/lib/shrunk";
import type { DriveIssue, PlaylistImage } from "@/lib/types";

/**
 * Pictures the server had to make smaller (too big for the screens), for the /slideshow
 * problems box. Asks for the headers only (HEAD, which the CDN answers from its cache), one
 * picture at a time, so a preview doesn't download every picture twice.
 */
export function useShrunkImages(images: PlaylistImage[] | undefined): DriveIssue[] {
  const [shrunk, setShrunk] = useState<DriveIssue[]>([]);
  const key = images?.map((i) => imageUrl(i.id, i.version)).join("\n") ?? "";

  useEffect(() => {
    if (!images?.length) return;
    let cancelled = false;
    void (async () => {
      const found: DriveIssue[] = [];
      for (const img of images) {
        if (cancelled) return;
        try {
          const res = await fetch(imageUrl(img.id, img.version), { method: "HEAD" });
          const from = Number(res.headers.get(SHRUNK_HEADER));
          const to = Number(res.headers.get(SENT_HEADER));
          if (res.ok && from > 0 && to > 0) found.push(shrunkIssue(img.name, from, to));
        } catch {
          /* offline or failed: nothing to report */
        }
      }
      if (!cancelled) setShrunk(found);
    })();
    return () => {
      cancelled = true;
    };
    // `key` stands for `images`: re-check only when the pictures or their versions change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return images?.length ? shrunk : [];
}
