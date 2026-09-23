import { apiRequest } from "./api-client";
import { toRecipe, type SpoonResult } from "./spoonacular-map";
import type { Recipe } from "./types";

export { mapUnit, stripHtml, toRecipe } from "./spoonacular-map";
export type { SpoonResult } from "./spoonacular-map";

/**
 * Spoonacular recipe search, proxied through the Workers recipe-search route
 * (the API key stays server-side and results are cached into the catalog).
 * Results are mapped onto our Recipe type so the rest of the app (RecipeDetail,
 * save, pantry matching) works unchanged.
 */
async function call(body: Record<string, unknown>): Promise<Recipe[]> {
  const data = await apiRequest<{ items: SpoonResult[] }>("/api/recipes/search", { method: "POST", body, timeoutMs: 25_000 });
  return data.items.map(toRecipe);
}

export function searchRecipes(opts: {
  query?: string;
  cuisine?: string;
  number?: number;
}): Promise<Recipe[]> {
  return call({ action: "search", ...opts });
}

export function randomRecipes(number = 12): Promise<Recipe[]> {
  return call({ action: "random", number });
}

/** Recipes that use as many of the given ingredient names as possible. */
export function recipesFromIngredients(ingredients: string[], number = 12): Promise<Recipe[]> {
  return call({ action: "search", includeIngredients: ingredients.slice(0, 30), number });
}

// Spoonacular-supported cuisines that match the household's interests.
export const SPOONACULAR_CUISINES = [
  "Vietnamese",
  "Thai",
  "Indian",
  "Chinese",
  "Italian",
  "French",
  "Korean",
  "Japanese",
  "Mexican",
  "Mediterranean",
  "African",
  "Greek",
  "Middle Eastern",
  "American",
];
