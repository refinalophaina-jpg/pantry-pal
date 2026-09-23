import { mergeIngredientNeeds, scaledIngredients } from "./ingredient-math";
import { foodTokens } from "./pantry-match";
import { prepDates, prepPortion } from "./prep-planner";
import type { MealPlanEntry, Recipe } from "./types";

/**
 * A three-day batch the household composes itself: any dishes, each cooked
 * once and eaten as lunch or dinner on the days they choose. Templates are
 * just prefilled assignments.
 */
export type PrepMeal = "lunch" | "dinner";
export interface PrepAssignment { recipe: Recipe; meal: PrepMeal; days: number[] }

export const PREP_DAY_LABELS = ["Day 1", "Day 2", "Day 3"];

export function portionsFor(assignment: PrepAssignment, people: number) {
  return Math.max(1, assignment.days.length) * people;
}

/** Ingredient needs for the whole batch: each dish scaled to its portions, then merged. */
export function batchNeeds(assignments: PrepAssignment[], people: number): Recipe["ingredients"] {
  return mergeIngredientNeeds(assignments.flatMap(assignment => scaledIngredients(assignment.recipe, portionsFor(assignment, people))));
}

/** Ingredients two or more dishes have in common, so one prep session covers both. */
export function sharedIngredients(assignments: PrepAssignment[]): string[] {
  const seen = new Map<string, { name: string; count: number }>();
  for (const { recipe } of assignments) {
    const names = new Set(recipe.ingredients.filter(item => !item.optional).map(item => foodTokens(item.name).join(" ")).filter(Boolean));
    for (const key of names) {
      const entry = seen.get(key) ?? { name: recipe.ingredients.find(item => foodTokens(item.name).join(" ") === key)!.name, count: 0 };
      entry.count++;
      seen.set(key, entry);
    }
  }
  return [...seen.values()].filter(entry => entry.count >= 2).map(entry => entry.name);
}

/** A deterministic cooking order: longest dish first, shared prep once, portion last. */
export function prepOrder(assignments: PrepAssignment[]): string[] {
  if (!assignments.length) return [];
  const byTime = [...assignments].sort((a, b) => b.recipe.minutes - a.recipe.minutes);
  const shared = sharedIngredients(assignments);
  const steps: string[] = [];
  if (shared.length) steps.push(`Wash, weigh and chop the shared ingredients once: ${shared.join(", ")}.`);
  steps.push(`Start ${byTime[0].recipe.name} first (about ${byTime[0].recipe.minutes} min) so it simmers while you work.`);
  for (const assignment of byTime.slice(1)) steps.push(`Cook ${assignment.recipe.name} (about ${assignment.recipe.minutes} min) in a second pan or once the first dish is resting.`);
  steps.push("Cool quickly in shallow containers, label with today's date, and keep garnishes and grains separate.");
  return steps;
}

export interface PrepPlanSlot { assignment: PrepAssignment; portion: Recipe; dates: Array<{ date: string; meal: PrepMeal }> }

/** Calendar entries for the batch, skipping slots that already hold a meal. */
export function prepPlanSlots(assignments: PrepAssignment[], start: string, people: number, existing: MealPlanEntry[]): PrepPlanSlot[] {
  const dates = prepDates(start);
  return assignments.map(assignment => {
    const portion = prepPortion(assignment.recipe, people, Math.max(1, assignment.days.length));
    const slots = [...new Set(assignment.days)].filter(day => day >= 0 && day < 3).sort()
      .map(day => ({ date: dates[day], meal: assignment.meal }))
      .filter(slot => !existing.some(entry => entry.date === slot.date && entry.meal === slot.meal));
    return { assignment, portion, dates: slots };
  });
}

export function templateAssignments(recipes: Recipe[]): PrepAssignment[] {
  return recipes.slice(0, 2).map((recipe, index) => ({ recipe, meal: index === 0 ? "lunch" : "dinner", days: [0, 1, 2] }));
}
