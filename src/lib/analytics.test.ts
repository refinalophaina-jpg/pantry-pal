import { describe, expect, it } from "vitest";
import { cuisineMix, insights, pantryHealth, topWasted, weeklyUsage } from "./analytics";
import type { MealPlanEntry, PantryItem, Recipe, UsageEvent } from "./types";

const today = new Date("2026-09-23T12:00:00Z");
const event = (at: string, reason: "used" | "wasted", itemName = "Spinach"): UsageEvent => ({ id: at + reason + itemName, itemId: "x", itemName, quantity: 1, unit: "pcs", reason, at });
const recipe = (id: string, cuisine: string): Recipe => ({ id, name: id, description: "", cuisine, minutes: 20, difficulty: "easy", servings: 2, equipment: [], ingredients: [], steps: [], tags: [] });

describe("household analytics", () => {
  it("buckets usage into Monday-starting weeks and lists the most wasted foods", () => {
    const usage = [event("2026-09-22T10:00:00Z", "wasted"), event("2026-09-21T10:00:00Z", "used"), event("2026-09-14T10:00:00Z", "wasted"), event("2026-07-01T10:00:00Z", "used"), event("2026-09-20T10:00:00Z", "wasted", "Milk")];
    const weeks = weeklyUsage(usage, 8, today);
    expect(weeks).toHaveLength(8);
    expect(weeks.at(-1)).toMatchObject({ start: "2026-09-21", used: 1, wasted: 1 });
    expect(weeks.at(-2)).toMatchObject({ start: "2026-09-14", used: 0, wasted: 2 });
    expect(weeks[0].used + weeks[0].wasted).toBe(0);
    expect(topWasted(usage, 56, today)).toEqual([{ name: "Spinach", count: 2 }, { name: "Milk", count: 1 }]);
  });
  it("summarises pantry health and the cuisine mix of planned meals", () => {
    const pantry: PantryItem[] = [
      { id: "1", name: "Milk", category: "Dairy", quantity: 1, unit: "l", zone: "fridge", addedOn: "2026-09-20", expiresOn: "2026-09-24" },
      { id: "2", name: "Old", category: "Other", quantity: 1, unit: "pcs", zone: "pantry", addedOn: "2026-06-01" },
      { id: "3", name: "Gone", category: "Other", quantity: 1, unit: "pcs", zone: "fridge", addedOn: "2026-09-01", expiresOn: "2026-09-01" },
    ];
    expect(pantryHealth(pantry, today)).toMatchObject({ total: 3, expired: 1, soon: 1, noDate: 1, stale: 1, byZone: [{ name: "pantry", count: 1 }, { name: "fridge", count: 2 }, { name: "freezer", count: 0 }] });
    const plan: MealPlanEntry[] = [{ id: "a", date: "2026-09-20", meal: "dinner", recipeId: "pho" }, { id: "b", date: "2026-09-21", meal: "dinner", recipeId: "pho" }, { id: "c", date: "2026-09-22", meal: "lunch", recipeId: "dal" }, { id: "d", date: "2026-12-01", meal: "dinner", recipeId: "dal" }];
    expect(cuisineMix(plan, [recipe("pho", "Vietnamese"), recipe("dal", "Indian")], 56, today)).toEqual([{ name: "Vietnamese", count: 2 }, { name: "Indian", count: 1 }]);
  });
  it("writes plain-language insights with numbers and an action", () => {
    const empty = insights({ usage: [], pantry: [], mealPlan: [], recipes: [], today });
    expect(empty[0]).toContain("No usage tracked yet");
    const usage = [event("2026-09-22T10:00:00Z", "wasted"), event("2026-09-15T10:00:00Z", "wasted"), event("2026-09-21T10:00:00Z", "used")];
    const notes = insights({ usage, pantry: [], mealPlan: [], recipes: [], today });
    expect(notes[0]).toMatch(/^67% of tracked items were wasted/);
    expect(notes[1]).toContain("Spinach was wasted 2 times");
  });
});
