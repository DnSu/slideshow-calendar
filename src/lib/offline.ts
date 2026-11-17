"use client";

/** Register the service worker (production only) and ask the browser to keep our storage. */
export async function setupOffline(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }
  if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
  try {
    await navigator.serviceWorker.register("/sw.js");
    const reg = await navigator.serviceWorker.ready;
    // Scripts/styles loaded before the worker took control: have it save them too.
    const urls = [
      location.pathname,
      ...performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .filter((u) => u.startsWith(location.origin + "/_next/")),
    ];
    reg.active?.postMessage({ type: "precache", urls });
  } catch (err) {
    console.warn("service worker setup failed", err);
  }
}

/** `version` changes when the file is replaced in Drive, giving the new picture a new URL. */
export function imageUrl(id: string, version?: string) {
  const base = `/api/image/${encodeURIComponent(id)}`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

/** Tell the worker which image URLs are still wanted; it deletes the rest (including old versions). */
export function pruneImages(urls: string[]) {
  navigator.serviceWorker?.controller?.postMessage({ type: "prune", urls });
}

/** Download every image once so the worker has saved it for offline use. Stops on first failure. */
export async function warmImages(urls: string[], isCancelled: () => boolean) {
  for (const url of urls) {
    if (isCancelled()) return;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      await res.arrayBuffer();
    } catch {
      return; // offline: try again after the next playlist refresh
    }
  }
}

export function preloadImage(url: string, timeoutMs = 10_000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(false), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.src = url;
  });
}
