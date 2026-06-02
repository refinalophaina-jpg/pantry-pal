import { describe, it, expect } from "vitest";
import { parseFraction, parseMeasure, mealToRecipe } from "./mealdb";

describe("parseFraction", () => {
  it("parses simple and mixed fractions", () => {
    expect(parseFraction("1/2")).toBe(0.5);
    expect(parseFraction("1 1/2")).toBe(1.5);
  });
  it("takes the midpoint of a range", () => {
    expect(parseFraction("2-3")).toBe(2.5);
  });
  it("parses decimals and rejects junk", () => {
    expect(parseFraction("0.75")).toBe(0.75);
    expect(parseFraction("")).toBeNull();
    expect(parseFraction("abc")).toBeNull();
  });
});

describe("parseMeasure", () => {
  it("extracts quantity + unit when a unit token is present", () => {
    expect(parseMeasure("200 g")).toEqual({ quantity: 200, unit: "g" });
    expect(parseMeasure("2 tbsp")).toEqual({ quantity: 2, unit: "tbsp" });
    expect(parseMeasure("1/2 cup")).toEqual({ quantity: 0.5, unit: "cup" });
  });
  it("defaults to 1 pcs for empty or unitless-unknown measures", () => {
    expect(parseMeasure("")).toEqual({ quantity: 1, unit: "pcs" });
    expect(parseMeasure("a pinch")).toEqual({ quantity: 1, unit: "pcs" });
    expect(parseMeasure("3")).toEqual({ quantity: 3, unit: "pcs" });
  });
});

function meal(over: Record<string, string | null> = {}) {
  return {
    idMeal: "52772",
    strMeal: "Teriyaki Chicken",
    strDrinkAlternate: null,
    strCategory: "Chicken",
    strArea: "Japanese",
    strInstructions: "Cook the rice.\nMake the sauce.\nGrill the chicken.",
    strMealThumb: "http://img/teriyaki.jpg",
    strTags: "Meat,Dinner",
    strYoutube: "http://yt/abc",
    strSource: null,
    strIngredient1: "soy sauce",
    strMeasure1: "1/2 cup",
    strIngredient2: "chicken",
    strMeasure2: "300 g",
    ...over,
  };
}

describe("mealToRecipe", () => {
  it("maps a MealDB meal onto the Recipe shape", () => {
    const r = mealToRecipe(meal());
    expect(r.id).toBe("mealdb-52772");
    expect(r.externalId).toBe("52772");
    expect(r.name).toBe("Teriyaki Chicken");
    expect(r.cuisine).toBe("Japanese");
    expect(r.area).toBe("Japanese");
    expect(r.ingredients).toEqual([
      { name: "soy sauce", quantity: 0.5, unit: "cup" },
      { name: "chicken", quantity: 300, unit: "g" },
    ]);
    expect(r.steps).toEqual([
      "Cook the rice.",
      "Make the sauce.",
      "Grill the chicken.",
    ]);
    expect(r.tags).toEqual(["Meat", "Dinner"]);
    expect(r.imageUrl).toBe("http://img/teriyaki.jpg");
    expect(r.video).toBe("http://yt/abc");
  });

  it("splits single-line instructions into sentences and applies heuristics", () => {
    const r = mealToRecipe(
      meal({
        strInstructions: "Boil water. Add pasta. Drain and serve.",
        strTags: null,
      }),
    );
    expect(r.steps).toEqual(["Boil water.", "Add pasta.", "Drain and serve."]);
    // 3 steps -> easy; minutes floored at 15
    expect(r.difficulty).toBe("easy");
    expect(r.minutes).toBe(24);
    // falls back to [category, area] tags when none provided
    expect(r.tags).toEqual(["Chicken", "Japanese"]);
  });

  it("scales difficulty + time with step count", () => {
    const many = Array.from({ length: 10 }, (_, i) => `Step ${i + 1}.`).join("\n");
    const r = mealToRecipe(meal({ strInstructions: many }));
    expect(r.difficulty).toBe("hard"); // >= 9 steps
    expect(r.minutes).toBe(80); // 10*8
  });
});
