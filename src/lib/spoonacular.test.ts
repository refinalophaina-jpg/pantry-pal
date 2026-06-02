import { describe, it, expect } from "vitest";
import { mapUnit, stripHtml, toRecipe } from "./spoonacular";

describe("mapUnit", () => {
  it("normalizes known unit names", () => {
    expect(mapUnit("grams")).toBe("g");
    expect(mapUnit("Tablespoons")).toBe("tbsp");
    expect(mapUnit("cup")).toBe("cup");
    expect(mapUnit("milliliters")).toBe("ml");
  });
  it("falls back to pcs for unknown/missing units", () => {
    expect(mapUnit("pinch")).toBe("pcs");
    expect(mapUnit(undefined)).toBe("pcs");
  });
});

describe("stripHtml", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripHtml("<b>Hello</b>   <i>world</i>")).toBe("Hello world");
    expect(stripHtml(undefined)).toBe("");
  });
});

describe("toRecipe", () => {
  it("maps a full Spoonacular result onto the Recipe shape", () => {
    const r = toRecipe({
      id: 42,
      title: "Pad Thai",
      image: "http://img/pad-thai.jpg",
      readyInMinutes: 30,
      servings: 3,
      cuisines: ["Thai"],
      dishTypes: ["dinner"],
      diets: ["vegetarian"],
      summary: "A classic noodle dish. More text here.",
      sourceUrl: "http://src",
      extendedIngredients: [
        { nameClean: "rice noodles", amount: 200, unit: "grams" },
        { name: "egg", amount: 2, unit: "" },
      ],
      analyzedInstructions: [
        { steps: [{ step: "Soak noodles." }, { step: "Stir-fry." }] },
      ],
    });
    expect(r.id).toBe("sp-42");
    expect(r.externalId).toBe("sp-42");
    expect(r.name).toBe("Pad Thai");
    expect(r.cuisine).toBe("Thai");
    expect(r.minutes).toBe(30);
    expect(r.difficulty).toBe("medium"); // 21–45 min
    expect(r.servings).toBe(3);
    expect(r.description).toBe("A classic noodle dish.");
    expect(r.ingredients).toEqual([
      { name: "rice noodles", quantity: 200, unit: "g" },
      { name: "egg", quantity: 2, unit: "pcs" },
    ]);
    expect(r.steps).toEqual(["Soak noodles.", "Stir-fry."]);
    expect(r.tags).toEqual(["vegetarian", "dinner"]);
    expect(r.imageUrl).toBe("http://img/pad-thai.jpg");
    expect(r.source).toBe("http://src");
  });

  it("applies sensible defaults for a sparse result", () => {
    const r = toRecipe({ id: 7, title: "Mystery" });
    expect(r.minutes).toBe(30);
    expect(r.difficulty).toBe("medium");
    expect(r.servings).toBe(2);
    expect(r.cuisine).toBe("International");
    expect(r.ingredients).toEqual([]);
    expect(r.steps).toEqual([
      "Open the source link below for the full instructions.",
    ]);
  });

  it("derives difficulty from time (<=20 easy, >45 hard)", () => {
    expect(toRecipe({ id: 1, title: "Quick", readyInMinutes: 15 }).difficulty).toBe(
      "easy",
    );
    expect(toRecipe({ id: 2, title: "Slow", readyInMinutes: 90 }).difficulty).toBe(
      "hard",
    );
  });

  it("rounds fractional ingredient amounts and defaults missing ones to 1", () => {
    const r = toRecipe({
      id: 9,
      title: "Frac",
      extendedIngredients: [
        { nameClean: "olive oil", amount: 1.333333, unit: "tablespoon" },
        { name: "salt", unit: "" },
      ],
    });
    expect(r.ingredients[0]).toEqual({
      name: "olive oil",
      quantity: 1.33,
      unit: "tbsp",
    });
    expect(r.ingredients[1].quantity).toBe(1);
  });
});
