import { describe, it, expect } from "vitest";
import { matchRecipeAgainstPantry } from "./store";
import type { Recipe, PantryItem, Equipment } from "./types";

function pantryItem(p: Partial<PantryItem>): PantryItem {
  return {
    id: "p",
    name: "x",
    category: "other",
    quantity: 1,
    unit: "pcs",
    zone: "pantry",
    addedOn: "2026-05-31",
    ...p,
  };
}

function recipe(partial: Partial<Recipe>): Recipe {
  return {
    id: "r",
    name: "R",
    description: "",
    cuisine: "Test",
    minutes: 20,
    difficulty: "easy",
    servings: 2,
    equipment: [],
    ingredients: [],
    steps: [],
    tags: [],
    ...partial,
  };
}

const eq = (name: string): Equipment => ({ id: name, name });

describe("matchRecipeAgainstPantry", () => {
  it("counts an ingredient as had only when the pantry has enough quantity", () => {
    const r = recipe({
      ingredients: [
        { name: "Rice", quantity: 2, unit: "cup" },
        { name: "Egg", quantity: 3, unit: "pcs" },
      ],
    });
    const pantry = [
      pantryItem({ name: "rice", quantity: 5, unit: "cup" }), // enough
      pantryItem({ name: "egg", quantity: 1, unit: "pcs" }), // too few
    ];
    const m = matchRecipeAgainstPantry(r, pantry, []);
    expect(m.have).toBe(1);
    expect(m.total).toBe(2);
    expect(m.score).toBeCloseTo(0.5);
    expect(m.canCook).toBe(false);
  });

  it("can cook when every required ingredient and all equipment are present", () => {
    const r = recipe({
      equipment: ["wok"],
      ingredients: [{ name: "tofu", quantity: 1, unit: "pcs" }],
    });
    const m = matchRecipeAgainstPantry(
      r,
      [pantryItem({ name: "Tofu", quantity: 2 })],
      [eq("wok")],
    );
    expect(m.have).toBe(1);
    expect(m.equipmentOk).toBe(true);
    expect(m.canCook).toBe(true);
    expect(m.score).toBe(1);
  });

  it("blocks cooking when required equipment is missing, even with all food", () => {
    const r = recipe({
      equipment: ["blender"],
      ingredients: [{ name: "banana", quantity: 1, unit: "pcs" }],
    });
    const m = matchRecipeAgainstPantry(
      r,
      [pantryItem({ name: "banana", quantity: 3 })],
      [eq("wok")],
    );
    expect(m.have).toBe(1);
    expect(m.equipmentOk).toBe(false);
    expect(m.canCook).toBe(false);
  });

  it("excludes optional ingredients from the total and the score", () => {
    const r = recipe({
      ingredients: [
        { name: "pasta", quantity: 1, unit: "pcs" },
        { name: "parsley", quantity: 1, unit: "pcs", optional: true },
      ],
    });
    const m = matchRecipeAgainstPantry(
      r,
      [pantryItem({ name: "pasta", quantity: 1 })],
      [],
    );
    expect(m.total).toBe(1);
    expect(m.have).toBe(1);
    expect(m.canCook).toBe(true);
  });

  it("scores an ingredient-free recipe as fully cookable", () => {
    const m = matchRecipeAgainstPantry(recipe({}), [], []);
    expect(m.total).toBe(0);
    expect(m.score).toBe(1);
    expect(m.canCook).toBe(true);
  });

  it("matches ingredient names case-insensitively", () => {
    const r = recipe({ ingredients: [{ name: "OLIVE OIL", quantity: 1, unit: "tbsp" }] });
    const m = matchRecipeAgainstPantry(
      r,
      [pantryItem({ name: "olive oil", quantity: 1, unit: "tbsp" })],
      [],
    );
    expect(m.have).toBe(1);
  });
});
