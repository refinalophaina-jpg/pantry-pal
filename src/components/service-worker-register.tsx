"use client";

import { useEffect } from "react";

/**
 * Service-worker JANITOR (not a registrar). A previously-installed caching SW
 * could pin stale builds and blank the page after redeploys, so during active
 * development we keep the app network-only: whenever it loads, unregister any
 * existing service worker and drop its caches. This self-heals devices and
 * prevents the whole class of "stuck on an old build" problems.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
    if (typeof caches !== "undefined") {
      caches
        .keys()
        .then((keys) => keys.forEach((k) => caches.delete(k)))
        .catch(() => {});
    }
  }, []);

  return null;
}
