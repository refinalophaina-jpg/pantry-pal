"use client";

import { useEffect } from "react";

/**
 * Registers the offline-shell service worker once, after load. Rendered near
 * the root so the PWA works on every page. No-ops where service workers aren't
 * supported (e.g. older browsers, non-secure contexts).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures are non-fatal — the app still works online.
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
