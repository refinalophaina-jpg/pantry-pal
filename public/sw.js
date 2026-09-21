/* Build replaces these constants with an immutable static asset manifest. */
const VERSION = "__BUILD_VERSION__";
const CACHE = `pantry-pal-static-${VERSION}`;
const ASSETS = /*__PRECACHE__*/ ["/offline/"];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // A failed installation leaves the previous worker/cache intact.
    await cache.addAll(ASSETS.map(url => new Request(url, { credentials: 'omit', redirect: 'error', cache: 'reload' })));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('pantry-pal-static-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'APPLY_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  // Never intercept authentication, household data, uploads or third parties.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch {
        const cache = await caches.open(CACHE);
        const fallback = url.pathname.replace(/\/$/, '') === '/offline-shopping' ? '/offline-shopping/' : '/offline/';
        return await cache.match(fallback) ?? new Response('You’re offline. Reconnect to open Pantry Pal.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith((async () => (await (await caches.open(CACHE)).match(url.pathname)) ?? fetch(request))());
  }
});
