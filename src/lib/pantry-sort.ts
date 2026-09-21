import type { PantryItem } from "./types";

export type SortMode = "expiry" | "name" | "added";

/** Sort pantry items by soonest expiry (no-expiry last), name, or newest first. */
export function sortPantry(items: PantryItem[], mode: SortMode): PantryItem[] {
  const copy = [...items];
  if (mode === "name") {
    return copy.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }
  if (mode === "added") {
    // Most recently added first; ties keep stable order.
    return copy.sort((a, b) => (b.addedOn ?? "").localeCompare(a.addedOn ?? ""));
  }
  // expiry: soonest first, items without an expiry sorted to the end.
  return copy.sort((a, b) => {
    const ad = a.expiresOn ?? "9999-99-99";
    const bd = b.expiresOn ?? "9999-99-99";
    return ad.localeCompare(bd);
  });
}

