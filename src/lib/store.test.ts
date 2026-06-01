import { describe, it, expect } from "vitest";
import {
  matchRecipeAgainstPantry,
  pantryFromRow,
  shoppingFromRow,
  mealPlanFromRow,
  usageFromRow,
  savedRecipeFromRow,
} from "./store";
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

describe("row mappers (sync deserialization)", () => {
  it("pantryFromRow maps snake_case, coerces quantity, nulls→undefined", () => {
    expect(
      pantryFromRow({
        id: "p1",
        household_id: "h",
        name: "Rice",
        category: "Grains",
        quantity: 2 as unknown as number,
        unit: "cup",
        zone: "pantry",
        expires_on: null,
        added_on: "2026-05-31",
        notes: null,
      }),
    ).toEqual({
      id: "p1",
      name: "Rice",
      category: "Grains",
      quantity: 2,
      unit: "cup",
      zone: "pantry",
      expiresOn: undefined,
      addedOn: "2026-05-31",
      notes: undefined,
    });
  });

  it("shoppingFromRow maps deal + recipe fields, null→undefined", () => {
    const s = shoppingFromRow({
      id: "s1",
      household_id: "h",
      name: "Milk",
      quantity: 1,
      unit: "l",
      category: "Dairy",
      done: true,
      from_recipe: null,
      deal_price: 2.5,
      deal_store: "H-E-B",
    });
    expect(s.done).toBe(true);
    expect(s.fromRecipe).toBeUndefined();
    expect(s.dealPrice).toBe(2.5);
    expect(s.dealStore).toBe("H-E-B");
  });

  it("mealPlanFromRow renames recipe_id → recipeId", () => {
    expect(
      mealPlanFromRow({
        id: "m1",
        household_id: "h",
        date: "2026-06-01",
        meal: "dinner",
        recipe_id: "r-42",
      }),
    ).toEqual({ id: "m1", date: "2026-06-01", meal: "dinner", recipeId: "r-42" });
  });

  it("usageFromRow defaults a null item_id to empty string", () => {
    const u = usageFromRow({
      id: "u1",
      household_id: "h",
      item_id: null,
      item_name: "Spinach",
      quantity: 1,
      unit: "pcs",
      reason: "wasted",
      at: "2026-06-01T10:00:00Z",
    });
    expect(u.itemId).toBe("");
    expect(u.reason).toBe("wasted");
  });

  it("savedRecipeFromRow prefixes id, sets savedId, fills defaults", () => {
    const r = savedRecipeFromRow({
      id: "abc",
      household_id: "h",
      name: "My Stew",
      description: null,
      cuisine: null,
      minutes: null,
      difficulty: null,
      servings: null,
      equipment: null,
      ingredients: null,
      steps: null,
      tags: null,
      external_id: null,
      image_url: null,
      area: null,
      source: null,
      video: null,
      calories: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
    });
    expect(r.id).toBe("saved-abc");
    expect(r.savedId).toBe("abc");
    expect(r.cuisine).toBe("Custom");
    expect(r.minutes).toBe(30);
    expect(r.difficulty).toBe("easy");
    expect(r.servings).toBe(2);
    expect(r.ingredients).toEqual([]);
    expect(r.steps).toEqual([]);
  });

  it("savedRecipeFromRow coerces numeric macros when present", () => {
    const r = savedRecipeFromRow({
      id: "x",
      household_id: "h",
      name: "Bowl",
      description: "tasty",
      cuisine: "Thai",
      minutes: 25,
      difficulty: "medium",
      servings: 4,
      equipment: ["wok"],
      ingredients: [{ name: "rice", quantity: 1, unit: "cup" }],
      steps: ["cook"],
      tags: ["quick"],
      external_id: "ext-1",
      image_url: "http://img",
      area: "Thai",
      source: "http://src",
      video: null,
      calories: 500,
      protein_g: "20" as unknown as number,
      carbs_g: "60" as unknown as number,
      fat_g: "10" as unknown as number,
    });
    expect(r.proteinG).toBe(20);
    expect(r.carbsG).toBe(60);
    expect(r.fatG).toBe(10);
    expect(r.equipment).toEqual(["wok"]);
  });
});
