import { describe, expect, it } from "vitest";
import { candidatePool, composeBrief } from "./week-brief";
import type { CatalogEntry } from "./catalog-index";
import type { Recipe } from "./types";

const entry = (slug: string, cuisine: string, ingredients: string[]): CatalogEntry => ({ slug, name: slug, cuisine, minutes: 30, difficulty: "easy", servings: 2, source: "themealdb", tags: [], ingredients });
const own: Recipe = { id: "saved-1", savedId: "1", name: "House dal", description: "", cuisine: "Indian", minutes: 40, difficulty: "easy", servings: 2, equipment: [], ingredients: [{ name: "Lentils", quantity: 1, unit: "cup" }, { name: "Spinach", quantity: 100, unit: "g" }], steps: ["Simmer."], tags: ["vegetarian"] };

describe("week brief and candidates", () => {
  it("composes a readable brief from moods, cuisines and notes", () => {
    expect(composeBrief({ moods: ["light"], cuisines: ["Vietnamese", "Thai"], notes: "no pork" })).toBe("Mostly vegetables, legumes and whole grains; high in fibre; lighter dinners. A mix of Vietnamese and Thai dishes. no pork");
    expect(composeBrief({ moods: [], cuisines: ["Nigerian"], notes: "" })).toBe("All Nigerian dishes.");
  });
  it("keeps own recipes, filters the catalog by cuisine, ranks by coverage and interleaves cuisines", () => {
    const index = [entry("v1", "Vietnamese", ["Rice noodles", "Beef", "Onion", "Lime"]), entry("v2", "Vietnamese", ["Tofu", "Tomato", "Spring onion"]), entry("t1", "Thai", ["Tofu", "Basil", "Chilli"]), entry("i1", "Indian", ["Chickpeas", "Tomato", "Onion"]), entry("x", "Thai", ["Salt"])];
    const pool = candidatePool({ own: [own], index, pantryNames: ["Tofu", "Tomatoes", "Spinach"], cuisines: ["Vietnamese", "Thai"], includeCatalog: true, limit: 10 });
    expect(pool[0]).toMatchObject({ id: "saved-1", source: "own", coverage: 0.5 });
    expect(pool.map((candidate) => candidate.id)).toEqual(["saved-1", "cat-v2", "cat-t1", "cat-v1"]);
    expect(pool.find((candidate) => candidate.id === "cat-v2")).toMatchObject({ source: "catalog", coverage: 0.67 });
    expect(candidatePool({ own: [own], index, pantryNames: [], cuisines: [], includeCatalog: false })).toHaveLength(1);
  });
});
