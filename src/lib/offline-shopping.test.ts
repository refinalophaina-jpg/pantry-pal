import { describe, expect, it } from "vitest";
import { validateOfflineSnapshot, SNAPSHOT_MAX_AGE_MS } from "./offline-shopping";
const now = Date.parse("2026-09-21T00:00:00Z");
const snapshot = { schemaVersion: 1, userId: "u1", householdId: "h1", householdName: "Home", fetchedAt: new Date(now).toISOString(), items: [{ id: "s1", name: "Milk", quantity: 1, unit: "l", category: "Dairy", done: false }] };
describe("read-only offline eligibility", () => {
  it("accepts a recent valid shopping snapshot", () => expect(validateOfflineSnapshot(snapshot, now)).toEqual(snapshot));
  it("rejects expired, future and unknown-schema records", () => {
    expect(validateOfflineSnapshot(snapshot, now + SNAPSHOT_MAX_AGE_MS + 1)).toBeNull();
    expect(validateOfflineSnapshot(snapshot, now - 1)).toBeNull();
    expect(validateOfflineSnapshot({ ...snapshot, schemaVersion: 9 }, now)).toBeNull();
  });
  it("rejects missing identity and corrupted shopping values", () => {
    expect(validateOfflineSnapshot({ ...snapshot, userId: "" }, now)).toBeNull();
    expect(validateOfflineSnapshot({ ...snapshot, items: [{ ...snapshot.items[0], quantity: NaN }] }, now)).toBeNull();
    expect(validateOfflineSnapshot({ ...snapshot, items: [{ ...snapshot.items[0], unit: "unknown" }] }, now)).toBeNull();
  });
  it("honors a persisted clear marker even when an interrupted delete left an old record", () => {
    expect(validateOfflineSnapshot(snapshot, now + 10, now)).toBeNull();
    expect(validateOfflineSnapshot(snapshot, now + 10, now + 1)).toBeNull();
    expect(validateOfflineSnapshot({ ...snapshot, fetchedAt: new Date(now + 5).toISOString() }, now + 10, now + 1)).not.toBeNull();
  });
});
