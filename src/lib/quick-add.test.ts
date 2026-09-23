import { describe, expect, it } from "vitest";
import { guessCategory, guessZone, parseQuickAdd } from "./quick-add";

describe("quick add parsing", () => {
  it("reads quantities and units before or after the name, with zones in brackets", () => {
    expect(parseQuickAdd("2 kg rice, 6 eggs (fridge)\nspinach 200g\n1/2 cup oats\ncoconut milk x2 in the pantry")).toEqual([
      { name: "Rice", quantity: 2, unit: "kg", zone: "pantry", category: "Grains" },
      { name: "Eggs", quantity: 6, unit: "pcs", zone: "fridge", category: "Protein" },
      { name: "Spinach", quantity: 200, unit: "g", zone: "fridge", category: "Produce" },
      { name: "Oats", quantity: 0.5, unit: "cup", zone: "pantry", category: "Grains" },
      { name: "Coconut milk", quantity: 2, unit: "pcs", zone: "pantry", category: "Dairy" },
    ]);
  });
  it("keeps a bare count out of the name and never treats a food word as a unit", () => {
    expect(parseQuickAdd("1 olive oil")).toEqual([{ name: "Olive oil", quantity: 1, unit: "pcs", zone: "pantry", category: "Oils" }]);
    expect(parseQuickAdd("3 limes")).toEqual([{ name: "Limes", quantity: 3, unit: "pcs", zone: "fridge", category: "Produce" }]);
    expect(parseQuickAdd("frozen peas")).toEqual([{ name: "Frozen peas", quantity: 1, unit: "pcs", zone: "freezer", category: "Frozen" }]);
  });
  it("drops empty lines, caps the batch, and guesses sensible homes", () => {
    expect(parseQuickAdd(" , ,\n")).toEqual([]);
    expect(parseQuickAdd(Array.from({ length: 50 }, (_, i) => `item ${i}`).join(","))).toHaveLength(40);
    expect(guessZone("Onion")).toBe("pantry");
    expect(guessZone("Chicken thighs")).toBe("fridge");
    expect(guessZone("Dry lentils")).toBe("pantry");
    expect(guessCategory("Soy sauce")).toBe("Condiments");
    expect(guessCategory("Mystery jar")).toBe("Other");
  });
});
