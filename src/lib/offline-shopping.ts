import type { ShoppingItem } from "./types";

export const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DB_NAME = "pantry-shopping-offline";
const STORE_NAME = "snapshots";
const KEY = "current";
const CLEAR_MARKER = "pantry-offline-cleared";
let generation = 0;

function clearedAt(): number {
  try { return Number(localStorage.getItem(CLEAR_MARKER)?.split(":")[0]) || 0; }
  catch { return 0; }
}

export interface OfflineShoppingSnapshot {
  schemaVersion: 1;
  userId: string;
  householdId: string;
  householdName: string;
  fetchedAt: string;
  items: ShoppingItem[];
}

export function validateOfflineSnapshot(value: unknown, now = Date.now(), lastClearedAt = 0): OfflineShoppingSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Partial<OfflineShoppingSnapshot>;
  const fetchedAt = Date.parse(s.fetchedAt ?? "");
  const age = now - fetchedAt;
  if (s.schemaVersion !== 1 || typeof s.userId !== "string" || !s.userId || typeof s.householdId !== "string" || !s.householdId || typeof s.householdName !== "string" || !Number.isFinite(age) || fetchedAt <= lastClearedAt || age < 0 || age > SNAPSHOT_MAX_AGE_MS || !Array.isArray(s.items) || s.items.length > 5000) return null;
  const units = new Set(["pcs", "g", "kg", "ml", "l", "tsp", "tbsp", "cup"]);
  if (!s.items.every((item) => item && typeof item.id === "string" && typeof item.name === "string" && item.name.length <= 500 && Number.isFinite(item.quantity) && item.quantity >= 0 && units.has(item.unit) && typeof item.done === "boolean" && typeof item.category === "string")) return null;
  return s as OfflineShoppingSnapshot;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Offline storage is unavailable.")); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Offline storage is busy."));
  });
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const request = action(tx.objectStore(STORE_NAME));
      let result: T;
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Offline write interrupted."));
    });
  } finally { db.close(); }
}

/** Only a confirmed authorized snapshot may replace the previous saved view. */
export async function saveOfflineShopping(snapshot: OfflineShoppingSnapshot) {
  if (!validateOfflineSnapshot(snapshot)) throw new Error("Invalid shopping snapshot.");
  const expected = generation;
  const db = await openDatabase();
  try {
    if (expected !== generation || !validateOfflineSnapshot(snapshot, Date.now(), clearedAt())) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      // Retain only display data, never auth tokens or complete API records.
      tx.objectStore(STORE_NAME).put({ ...snapshot, items: snapshot.items.map(({ id, name, quantity, unit, category, done }) => ({ id, name, quantity, unit, category, done })) }, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function readOfflineShopping() {
  const value = await transaction("readonly", (store) => store.get(KEY));
  const snapshot = validateOfflineSnapshot(value, Date.now(), clearedAt());
  if (value && !snapshot) await transaction("readwrite", (store) => store.delete(KEY));
  return snapshot;
}

/** Purges other open tabs through a notification; only this DB is touched. */
export async function clearOfflineShopping() {
  generation++;
  if (typeof window !== "undefined") {
    // This synchronous tombstone survives a reload that interrupts the IDB delete.
    // A later successful authenticated sync can save a newer snapshot.
    try { localStorage.setItem(CLEAR_MARKER, `${Date.now()}:${Math.random()}`); } catch { /* storage may be unavailable */ }
    window.dispatchEvent(new Event("pantry:offline-cleared"));
  }
  try { await transaction("readwrite", (store) => store.delete(KEY)); } catch { /* absent/unavailable storage is already unreadable */ }
}
