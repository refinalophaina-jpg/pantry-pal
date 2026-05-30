// Pantry Pal service worker — offline shell without staleness.
//
// Strategy:
//   - Content-hashed build assets (/_next/static/**) are immutable → cache-first.
//   - Everything else (HTML/navigations, manifest, illustrations) → network-first,
//     falling back to cache only when offline. This guarantees the latest deploy
//     loads while online (no "stuck on an old build").
//   - Cross-origin requests (Supabase API/auth, TheMealDB, Open Food Facts) are
//     never touched, so live data and auth always go to the network.
//
// Bump CACHE on releases to evict prior caches via the activate handler.
const CACHE = "pantry-pal-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin alone

  // Immutable, content-hashed assets → cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // HTML / navigations / other same-origin GETs → network-first, cache fallback.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || Promise.reject(req))),
  );
});
