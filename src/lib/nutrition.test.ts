import { describe, it, expect, vi } from "vitest";
import type { Recipe } from "./types";
import { lookupNutrition, estimateRecipeNutrition } from "./nutrition";

// Make the Supabase cache fallback hermetic: any uncached ingredient resolves
// to "not found" instead of hitting the network.
vi.mock("./supabase", () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null }) }),
      }),
    }),
  }),
}));

function recipe(partial: Partial<Recipe>): Recipe {
  return {
    id: "r1",
    name: "Test",
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

describe("lookupNutrition", () => {
  it("finds a builtin ingredient by exact name", async () => {
    const rice = await lookupNutrition("rice");
    expect(rice?.calories).toBe(130);
  });

  it("normalizes prefixes and plural/singular", async () => {
    expect((await lookupNutrition("Fresh Spinach"))?.calories).toBe(23);
    // "tomatoes" -> singular "tomato"
    expect((await lookupNutrition("tomatoes"))?.perPiece).toBe(true);
  });

  it("falls back to last-word match for compound names", async () => {
    // "sunflower oil" -> "oil"
    expect((await lookupNutrition("sunflower oil"))?.calories).toBe(884);
  });

  it("returns null for unknown ingredients (no cache hit)", async () => {
    expect(await lookupNutrition("unobtainium")).toBeNull();
  });
});

describe("estimateRecipeNutrition", () => {
  it("sums per-100g contributions and divides per serving", async () => {
    const n = await estimateRecipeNutrition(
      recipe({
        servings: 2,
        ingredients: [
          { name: "rice", quantity: 200, unit: "g" }, // 130*2 = 260 cal
          { name: "olive oil", quantity: 1, unit: "tbsp" }, // 884*0.15 = 132.6 cal
        ],
      }),
    );
    expect(n.knownIngredients).toBe(2);
    expect(n.totalIngredients).toBe(2);
    expect(n.calories).toBe(393); // round(392.6)
    expect(n.perServing.calories).toBe(196); // round(392.6/2)
  });

  it("ignores optional ingredients and unknown ones", async () => {
    const n = await estimateRecipeNutrition(
      recipe({
        servings: 1,
        ingredients: [
          { name: "rice", quantity: 100, unit: "g" }, // 130 cal
          { name: "saffron threads", quantity: 1, unit: "pcs" }, // unknown -> 0
          { name: "garnish", quantity: 1, unit: "pcs", optional: true }, // skipped
        ],
      }),
    );
    expect(n.totalIngredients).toBe(2); // optional excluded from the count
    expect(n.knownIngredients).toBe(1);
    expect(n.calories).toBe(130);
  });

  it("uses gramsPerPiece for piece-based ingredients", async () => {
    const n = await estimateRecipeNutrition(
      recipe({
        servings: 1,
        ingredients: [{ name: "egg", quantity: 2, unit: "pcs" }], // 2*50g = 100g -> 155 cal
      }),
    );
    expect(n.calories).toBe(155);
  });
});
