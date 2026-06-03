import { describe, it, expect } from "vitest";
import { sortPantry } from "./page";
import type { PantryItem } from "@/lib/types";

function item(over: Partial<PantryItem>): PantryItem {
  return {
    id: Math.random().toString(36).slice(2),
    name: "X",
    category: "Other",
    quantity: 1,
    unit: "pcs",
    zone: "pantry",
    addedOn: "2026-05-01",
    ...over,
  };
}

const a = item({ name: "Banana", expiresOn: "2026-06-10", addedOn: "2026-05-01" });
const b = item({ name: "apple", expiresOn: undefined, addedOn: "2026-06-02" });
const c = item({ name: "Cherry", expiresOn: "2026-06-03", addedOn: "2026-05-20" });

describe("sortPantry", () => {
  it("expiry: soonest first, no-expiry last", () => {
    const out = sortPantry([a, b, c], "expiry").map((i) => i.name);
    expect(out).toEqual(["Cherry", "Banana", "apple"]);
  });

  it("name: case-insensitive A–Z", () => {
    const out = sortPantry([a, b, c], "name").map((i) => i.name);
    expect(out).toEqual(["apple", "Banana", "Cherry"]);
  });

  it("added: most recently added first", () => {
    const out = sortPantry([a, b, c], "added").map((i) => i.name);
    expect(out).toEqual(["apple", "Cherry", "Banana"]);
  });

  it("does not mutate the input array", () => {
    const input = [a, b, c];
    const snapshot = input.map((i) => i.name);
    sortPantry(input, "name");
    expect(input.map((i) => i.name)).toEqual(snapshot);
  });
});
