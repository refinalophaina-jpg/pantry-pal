// Self-destructing service worker.
//
// An earlier caching service worker could pin stale builds (cached HTML pointing
// at hashed chunks that no longer exist after a redeploy → blank page). During
// active development we don't want ANY service worker. Browsers re-check this
// script on navigation, so shipping this version makes previously-stuck devices
// heal automatically: it unregisters itself, clears all caches, and reloads.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        /* ignore */
      }
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => {
        // Reload each open tab so it fetches a fresh, un-intercepted build.
        if ("navigate" in c) c.navigate(c.url);
      });
    })(),
  );
});

// Pass every request straight through to the network — never serve from cache.
self.addEventListener("fetch", () => {});
