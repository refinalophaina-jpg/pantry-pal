import { apiRequest } from "./api-client";
import type { Recipe, UnitType } from "./types";

/**
 * Assistant-drafted dishes and plate photos. Drafts are proposals: nothing is
 * saved until the household chooses to keep one.
 */
export interface DraftedDish { recipe: Recipe; why: string; fromPantry: string[] }

interface DraftRow {
  id: string; name: string; description: string; cuisine: string; minutes: number; difficulty: Recipe["difficulty"]; servings: number;
  ingredients: Array<{ name: string; quantity: number; unit: UnitType; fromPantry: boolean }>; steps: string[]; tags: string[]; why: string;
}

export async function draftDishes(householdId: string, options: { brief?: string; cuisine?: string; count?: number; focus?: string[] } = {}): Promise<DraftedDish[]> {
  const body: Record<string, unknown> = { householdId, count: options.count ?? 3 };
  if (options.brief?.trim()) body.brief = options.brief.trim();
  if (options.cuisine?.trim()) body.cuisine = options.cuisine.trim();
  if (options.focus?.length) body.focus = options.focus.slice(0, 20);
  const { dishes } = await apiRequest<{ dishes: DraftRow[] }>("/api/recipes/invent", { method: "POST", body, timeoutMs: 90_000 });
  return dishes.map(dish => ({
    recipe: {
      id: dish.id, name: dish.name, description: dish.description, cuisine: dish.cuisine, minutes: dish.minutes, difficulty: dish.difficulty,
      servings: dish.servings, equipment: [], ingredients: dish.ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
      steps: dish.steps, tags: dish.tags, externalId: dish.id, source: undefined,
    },
    why: dish.why,
    fromPantry: dish.ingredients.filter(item => item.fromPantry).map(item => item.name),
  }));
}

export async function illustrateRecipe(householdId: string, recipe: Pick<Recipe, "name" | "description" | "cuisine">): Promise<string> {
  const { imageUrl } = await apiRequest<{ imageUrl: string }>("/api/recipes/illustrate", {
    method: "POST", body: { householdId, name: recipe.name, description: recipe.description.slice(0, 300), cuisine: recipe.cuisine }, timeoutMs: 90_000,
  });
  return imageUrl;
}
