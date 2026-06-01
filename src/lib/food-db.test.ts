import { describe, it, expect } from "vitest";
import {
  ingredientFromRow,
  foodFromRow,
  techniqueFromRow,
  ingredientNutrition,
  type Ingredient,
} from "./food-db";

describe("ingredientFromRow", () => {
  it("maps snake_case columns to a typed Ingredient", () => {
    const ing = ingredientFromRow({
      id: "i1",
      slug: "tomato",
      name: "Tomato",
      category: "Produce",
      aliases: ["tomatoes"],
      density_g_per_ml: null,
      grams_per_piece: "120",
      calories: "18",
      protein_g: "0.9",
      carbs_g: "3.9",
      fat_g: "0.2",
      fiber_g: "1.2",
      source: "curated",
    });
    expect(ing).toEqual({
      id: "i1",
      slug: "tomato",
      name: "Tomato",
      category: "Produce",
      aliases: ["tomatoes"],
      densityGPerMl: undefined,
      gramsPerPiece: 120,
      calories: 18,
      proteinG: 0.9,
      carbsG: 3.9,
      fatG: 0.2,
      fiberG: 1.2,
      source: "curated",
    });
  });

  it("defaults missing arrays/category safely", () => {
    const ing = ingredientFromRow({ id: "x", slug: "s", name: "N" });
    expect(ing.aliases).toEqual([]);
    expect(ing.category).toBe("Other");
    expect(ing.calories).toBeUndefined();
  });
});

describe("foodFromRow", () => {
  it("maps a branded product and keeps undefined for absent fields", () => {
    const f = foodFromRow({
      id: "f1",
      barcode: "0123456789012",
      name: "Oat Milk",
      brand: "Oatly",
      category: "Dairy & Alternatives",
      ingredient_id: null,
      calories: "46",
    });
    expect(f.barcode).toBe("0123456789012");
    expect(f.brand).toBe("Oatly");
    expect(f.ingredientId).toBeUndefined();
    expect(f.calories).toBe(46);
  });
});

describe("techniqueFromRow", () => {
  it("maps a technique with tags and difficulty", () => {
    const t = techniqueFromRow({
      id: "t1",
      slug: "searing",
      title: "Searing",
      category: "Heat & Protein",
      difficulty: "medium",
      minutes: "15",
      summary: "Brown protein in a hot pan.",
      body: "",
      tags: ["protein", "heat"],
    });
    expect(t.difficulty).toBe("medium");
    expect(t.minutes).toBe(15);
    expect(t.tags).toEqual(["protein", "heat"]);
  });
});

describe("ingredientNutrition", () => {
  const base: Ingredient = {
    id: "i",
    slug: "rice",
    name: "Rice",
    category: "Grains & Bread",
    aliases: [],
    source: "curated",
  };

  it("returns a Nutrition object when calories are present", () => {
    expect(
      ingredientNutrition({ ...base, calories: 130, proteinG: 2.7 }),
    ).toEqual({
      calories: 130,
      proteinG: 2.7,
      carbsG: undefined,
      fatG: undefined,
      fiberG: undefined,
    });
  });

  it("returns null when the ingredient has no nutrition data", () => {
    expect(ingredientNutrition(base)).toBeNull();
  });
});
