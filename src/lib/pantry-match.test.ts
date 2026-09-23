import { describe, expect, it } from "vitest";
import { foodMatches, foodTokens, isStaple, matchAgainstPantry, rankByPantry } from "./pantry-match";

describe("pantry matching", () => {
  it("ignores descriptors and plurals but not derived products", () => {
    expect(foodTokens("2 large fresh Roma tomatoes, chopped")).toEqual(["roma", "tomato"]);
    expect(foodMatches("Cherry tomatoes", "tomato")).toBe(true);
    expect(foodMatches("Chicken breast", "chicken")).toBe(true);
    expect(foodMatches("Baby spinach", "spinach leaves")).toBe(true);
    expect(foodMatches("Rice", "rice noodles")).toBe(false);
    expect(foodMatches("Garlic", "garlic powder")).toBe(false);
    expect(foodMatches("Coconut", "coconut milk")).toBe(false);
    expect(foodMatches("Coconut milk", "coconut milk")).toBe(true);
    expect(foodMatches("Eggs", "egg")).toBe(true);
    expect(foodMatches("Beef", "beef bones")).toBe(true);
  });
  it("treats common seasonings as staples that do not count against coverage", () => {
    expect(isStaple("Salt")).toBe(true);
    expect(isStaple("Olive oil")).toBe(true);
    expect(isStaple("Firm tofu")).toBe(false);
    const match = matchAgainstPantry({ ingredients: ["Salt", "Firm tofu", "Rice noodles", "Spring onion"] }, ["Tofu", "Rice noodles"]);
    expect(match).toMatchObject({ have: 2, total: 3, matched: ["Firm tofu", "Rice noodles"], missing: ["Spring onion"] });
    expect(match.coverage).toBeCloseTo(2 / 3);
  });
  it("ranks by coverage, then matched count, then speed, and requires two real matches", () => {
    const entries = [
      { id: "a", minutes: 40, ingredients: ["Eggs", "Rice", "Spring onion"] },
      { id: "b", minutes: 20, ingredients: ["Eggs", "Rice", "Peas", "Soy sauce"] },
      { id: "c", minutes: 10, ingredients: ["Eggs", "Bread"] },
      { id: "d", minutes: 10, ingredients: ["Salt", "Eggs", "Rice"] },
    ];
    const ranked = rankByPantry(entries, ["Eggs", "Rice"]);
    expect(ranked.map((match) => match.entry.id)).toEqual(["d", "b", "a"]);
    expect(ranked[0]).toMatchObject({ have: 2, total: 2, coverage: 1 });
  });
});
