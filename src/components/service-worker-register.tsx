"use client";
import { useEffect, useRef, useState } from "react";

export function ServiceWorkerRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const applying = useRef(false);
  useEffect(() => {
    // Native shells (capacitor://, tauri://) serve the export from a local scheme where a
    // service worker is neither supported nor useful; only http(s) origins register one.
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production' || !window.location.protocol.startsWith('http')) return;
    let disposed = false;
    const onController = () => { if (applying.current) window.location.reload(); };
    navigator.serviceWorker.addEventListener('controllerchange', onController);
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(registration => {
      if (disposed) return;
      if (registration.waiting) setWaiting(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => {
          if (!disposed && installing.state === 'installed' && navigator.serviceWorker.controller) setWaiting(registration.waiting);
        });
      });
    }).catch(() => { /* Online use remains available if a service worker is unavailable. */ });
    return () => { disposed = true; navigator.serviceWorker.removeEventListener('controllerchange', onController); };
  }, []);
  if (!waiting) return null;
  return <div role="status" className="fixed top-4 left-4 right-4 sm:left-auto sm:max-w-sm z-[80] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
    <p className="text-sm">An update is ready. Finish any edits before reloading.</p>
    <button className="mt-2 min-h-11 font-medium underline" onClick={() => { applying.current = true; waiting.postMessage({ type: 'APPLY_UPDATE' }); }}>Reload and update</button>
    <button className="ml-4 min-h-11 text-sm" onClick={() => setWaiting(null)}>Later</button>
  </div>;
}
