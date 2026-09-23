import { describe, expect, it } from "vitest";
import { batchNeeds, prepOrder, prepPlanSlots, sharedIngredients, templateAssignments } from "./prep-builder";
import { prepRecipes } from "./prep-recipes";
import type { Recipe } from "./types";

const [thai, dal] = prepRecipes;
const quick: Recipe = { id: "quick", name: "Quick eggs", description: "", cuisine: "Thai", minutes: 10, difficulty: "easy", servings: 2, equipment: [], ingredients: [{ name: "Eggs", quantity: 4, unit: "pcs" }, { name: "Raw garlic", quantity: 6, unit: "g" }], steps: ["Fry."], tags: [] };

describe("prep batch builder", () => {
  it("scales each dish to its own portions and merges shared needs", () => {
    const needs = batchNeeds([{ recipe: thai, meal: "lunch", days: [0, 1, 2] }, { recipe: quick, meal: "dinner", days: [0] }], 2);
    expect(needs.find((item) => item.name === "Firm tofu")).toMatchObject({ quantity: 1200, unit: "g" });
    expect(needs.find((item) => item.name === "Eggs")).toMatchObject({ quantity: 4, unit: "pcs" });
    expect(needs.find((item) => item.name === "Raw garlic")!.quantity).toBeCloseTo(24 + 6);
    expect(sharedIngredients([{ recipe: thai, meal: "lunch", days: [0] }, { recipe: dal, meal: "dinner", days: [0] }])).toEqual(["Raw garlic", "Olive oil"]);
  });
  it("orders the longest dish first and mentions shared prep once", () => {
    const steps = prepOrder([{ recipe: quick, meal: "lunch", days: [0] }, { recipe: dal, meal: "dinner", days: [0, 1] }]);
    expect(steps[0]).toContain("shared ingredients once: Raw garlic");
    expect(steps[1]).toContain("Start Indian-inspired lentil & spinach dal first");
    expect(steps.at(-1)).toContain("label with today's date");
  });
  it("plans only empty slots on the chosen days and keeps template behaviour", () => {
    const existing = [{ id: "e", date: "2027-03-16", meal: "dinner" as const, recipeId: "other" }];
    const slots = prepPlanSlots([{ recipe: quick, meal: "dinner", days: [0, 1, 2] }, { recipe: thai, meal: "lunch", days: [2] }], "2027-03-15", 2, existing);
    expect(slots[0].dates).toEqual([{ date: "2027-03-15", meal: "dinner" }, { date: "2027-03-17", meal: "dinner" }]);
    expect(slots[0].portion).toMatchObject({ externalId: "quick-2p", servings: 2 });
    expect(slots[0].portion.description).toContain("cook three times these quantities");
    expect(slots[1].dates).toEqual([{ date: "2027-03-17", meal: "lunch" }]);
    expect(slots[1].portion.description).toContain("cook these quantities once");
    expect(templateAssignments([thai, dal]).map((item) => `${item.meal}:${item.days.length}`)).toEqual(["lunch:3", "dinner:3"]);
  });
});
