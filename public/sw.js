/* Service worker: saves the page shell, images and the latest playlist for offline use. */
const SHELL = "shell-v1";
const IMAGES = "images-v1";
const DATA = "data-v1";
const KEEP = [SHELL, IMAGES, DATA];
const NETWORK_TIMEOUT_MS = 5000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!KEEP.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

function fetchWithTimeout(request, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(request, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function networkFirst(request, cacheName, cacheKey, markCached) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
    if (res.ok) await cache.put(cacheKey, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(cacheKey, { ignoreSearch: true });
    if (!hit) throw err;
    if (!markCached) return hit;
    const headers = new Headers(hit.headers);
    headers.set("X-From-Cache", "1");
    return new Response(hit.body, { status: hit.status, headers });
  }
}

async function cacheFirst(request, cacheName, accept, fallbackIgnoringSearch) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok && accept(res)) await cache.put(request, res.clone());
    return res;
  } catch (err) {
    // Offline and this version isn't saved yet: show the older saved version of the same image.
    const old = fallbackIgnoringSearch && (await cache.match(request, { ignoreSearch: true }));
    if (old) return old;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, SHELL, url.pathname, false));
  } else if (url.pathname === "/api/playlist") {
    event.respondWith(networkFirst(req, DATA, "/api/playlist", true));
  } else if (url.pathname.startsWith("/api/image/")) {
    event.respondWith(
      cacheFirst(req, IMAGES, (r) => (r.headers.get("content-type") || "").startsWith("image/"), true),
    );
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, SHELL, () => true));
  }
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "precache" && Array.isArray(data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(SHELL);
        let allSaved = true;
        for (const raw of data.urls) {
          try {
            const url = new URL(raw, self.location.origin);
            if (url.origin !== self.location.origin) continue;
            const key = url.pathname.startsWith("/_next/") ? url.pathname + url.search : url.pathname;
            if (await cache.match(key)) continue;
            const res = await fetch(url.pathname + url.search);
            if (res.ok) await cache.put(key, res);
            else allSaved = false;
          } catch {
            allSaved = false; /* offline: retry on next load */
          }
        }
        // Only clean up once every file this version needs is saved, so a dropped connection
        // mid-save never leaves an offline screen without either version.
        // The page came from the network: drop app files it no longer uses (older deploys).
        // Only /_next/static/ entries in SHELL; page HTML, images and data are never touched.
        const keep = data.urls.map((raw) => {
          const u = new URL(raw, self.location.origin);
          return u.pathname + u.search;
        });
        if (data.prune === true && allSaved && keep.some((k) => k.startsWith("/_next/static/"))) {
          const wanted = new Set(keep);
          for (const req of await cache.keys()) {
            const u = new URL(req.url);
            if (u.pathname.startsWith("/_next/static/") && !wanted.has(u.pathname + u.search)) {
              await cache.delete(req);
            }
          }
        }
      })(),
    );
  } else if (data.type === "prune" && Array.isArray(data.urls)) {
    event.waitUntil(
      (async () => {
        // Compare path and query, so an old version (?v=...) of a still-wanted image is deleted too.
        const key = (u) => {
          const url = new URL(u, self.location.origin);
          return url.pathname + url.search;
        };
        const wanted = new Set(data.urls.map(key));
        const cache = await caches.open(IMAGES);
        for (const req of await cache.keys()) {
          if (!wanted.has(key(req.url))) await cache.delete(req);
        }
      })(),
    );
  }
});
