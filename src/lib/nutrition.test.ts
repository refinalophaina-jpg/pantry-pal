import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Recipe } from "./types";
import { lookupNutrition, estimateRecipeNutrition } from "./nutrition";
import { lookupIngredientByName } from "./food-db";

// Nutrition math tests keep the optional HTTP cache hermetic.
vi.mock("./api-client", () => ({ apiRequest: vi.fn().mockResolvedValue({ data: null }) }));

// Mock the canonical-ingredient DB lookup; default: nothing found.
vi.mock("./food-db", () => ({
  lookupIngredientByName: vi.fn().mockResolvedValue(null),
}));
const mockedDbLookup = vi.mocked(lookupIngredientByName);

beforeEach(() => {
  mockedDbLookup.mockReset();
  mockedDbLookup.mockResolvedValue(null);
});

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
    const rice = await lookupNutrition("Cooked white long-grain rice");
    expect(rice?.calories).toBe(130);
  });

  it("normalizes prefixes and plural/singular", async () => {
    expect((await lookupNutrition("Fresh Spinach"))?.calories).toBe(23);
    // "tomatoes" -> singular "tomato"
    expect((await lookupNutrition("tomatoes"))?.perPiece).toBe(true);
  });

  it("does not guess a compound food from its final word", async () => {
    expect(await lookupNutrition("mystery oil")).toBeNull();
  });

  it("returns null for unknown ingredients (no cache hit)", async () => {
    expect(await lookupNutrition("unobtainium")).toBeNull();
  });

  it("falls back to the canonical ingredients DB when not builtin", async () => {
    mockedDbLookup.mockResolvedValueOnce({
      id: "i1",
      slug: "dragonfruit",
      name: "Dragonfruit",
      category: "Produce",
      aliases: [],
      gramsPerPiece: 300,
      calories: 60,
      proteinG: 1.2,
      carbsG: 13,
      fatG: 0,
      fiberG: 3,
      source: "usda",
    });
    const per = await lookupNutrition("dragonfruit");
    expect(per?.calories).toBe(60);
    // grams_per_piece from the DB row drives piece-based scaling.
    expect(per?.gramsPerPiece).toBe(300);
    expect(per?.perPiece).toBe(true);
  });

  it("prefers the builtin table over the DB (no DB call for builtin hits)", async () => {
    const per = await lookupNutrition("Cooked white long-grain rice");
    expect(per?.calories).toBe(130);
    expect(mockedDbLookup).not.toHaveBeenCalled();
  });
});

describe("estimateRecipeNutrition", () => {
  it("sums per-100g contributions and divides per serving", async () => {
    const n = await estimateRecipeNutrition(
      recipe({
        servings: 2,
        ingredients: [
          { name: "Cooked white long-grain rice", quantity: 200, unit: "g" }, // 130*2 = 260 cal
          { name: "olive oil", quantity: 1, unit: "tbsp" }, // 884*0.15 = 132.6 cal
        ],
      }),
    );
    expect(n.knownIngredients).toBe(2);
    expect(n.totalIngredients).toBe(2);
    expect(n.calories).toBe(381); // round(392.6)
    expect(n.perServing.calories).toBe(190); // round(392.6/2)
  });

  it("ignores optional ingredients and unknown ones", async () => {
    const n = await estimateRecipeNutrition(
      recipe({
        servings: 1,
        ingredients: [
          { name: "Cooked white long-grain rice", quantity: 100, unit: "g" }, // 130 cal
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

it("keeps raw and cooked foods distinct and skips unweighed portions", async () => {
  expect(await lookupNutrition("rice")).toBeNull();
  expect((await lookupNutrition("Dry lentils"))?.calories).not.toBe((await lookupNutrition("Cooked lentils"))?.calories);
  const result = await estimateRecipeNutrition(recipe({ ingredients: [{name: "Dry oats",quantity: 1,unit: "cup"}, {name: "Raw spinach",quantity: 1,unit: "pcs"}] }));
  expect(result.knownIngredients).toBe(0);
  expect(result.missingIngredients).toEqual(["Dry oats", "Raw spinach"]);
});
it("uses an ingredient-specific density from the database", async () => {
  mockedDbLookup.mockResolvedValueOnce({id:"x",slug:"syrup-x",name:"Syrup x",category:"Other",aliases:[],source:"curated",calories:100,densityGPerMl:1.3});
  const result=await estimateRecipeNutrition(recipe({servings:1,ingredients:[{name:"Syrup x",quantity:10,unit:"ml"}]}));
  expect(result.calories).toBe(13);
});
