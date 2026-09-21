"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearOfflineShopping, readOfflineShopping, validateOfflineSnapshot, type OfflineShoppingSnapshot } from "@/lib/offline-shopping";

/** Previously downloaded content is separate from the authenticated app. */
export default function OfflineShoppingPage() {
  const [snapshot, setSnapshot] = useState<OfflineShoppingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  useEffect(() => {
    let active = true;
    let invalidated = false;
    void readOfflineShopping().then((value) => { if (active && !invalidated) setSnapshot(value); }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    const clear = () => { invalidated = true; setSnapshot(null); };
    const storage = (event: StorageEvent) => { if (event.key === "pantry-offline-cleared") clear(); };
    const timer = setInterval(() => setSnapshot((value) => validateOfflineSnapshot(value)), 30_000);
    window.addEventListener("pantry:offline-cleared", clear);
    window.addEventListener("storage", storage);
    return () => { active = false; clearInterval(timer); window.removeEventListener("pantry:offline-cleared", clear); window.removeEventListener("storage", storage); };
  }, []);
  return <main className="mx-auto max-w-xl p-6 pb-24">
    <h1 className="text-2xl font-semibold">Saved shopping list</h1>
    <p className="mt-3 text-sm text-[var(--text-secondary)]">Read-only list saved on this device. Reconnect and sign in to make changes. Saved lists expire after 24 hours.</p>
    {loading || clearing ? <p className="mt-6" role="status">{clearing ? "Clearing saved list…" : "Opening saved list…"}</p> : snapshot ? <>
      <h2 className="mt-6 font-semibold">{snapshot.householdName}</h2>
      <p className="mb-4 text-sm" role="status">Last synced {new Date(snapshot.fetchedAt).toLocaleString()}</p>
      <ul className="divide-y divide-[var(--border)]">{snapshot.items.map((item) => <li className="py-4 flex items-center gap-3" key={item.id}>
        <span aria-label={item.done ? "Previously checked" : "Not checked"}>{item.done ? "✓" : "○"}</span>
        <span className={item.done ? "line-through opacity-60" : ""}>{item.name}</span>
        <span className="ml-auto text-sm">{item.quantity} {item.unit}</span>
      </li>)}</ul>
      {snapshot.items.length === 0 && <p className="mt-4">Your last saved list was empty.</p>}
      <button className="mt-6 min-h-11 rounded-lg border border-[var(--border)] px-4" onClick={async () => { setClearing(true); await clearOfflineShopping(); setClearing(false); }}>Clear saved list</button>
    </> : <p className="mt-6" role="status">No recent list is saved. Open Shopping while signed in and connected first.</p>}
    <Link className="mt-6 inline-flex min-h-11 items-center underline" href="/shopping/">Return to live shopping</Link>
  </main>;
}
