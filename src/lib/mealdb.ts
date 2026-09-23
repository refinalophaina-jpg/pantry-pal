/**
 * TheMealDB V1 with its documented developer/educational key "1".
 * https://www.themealdb.com/api.php requires a supporter key for app-store release.
 * Calls go directly from the browser; CORS is open.
 */

import type { Recipe } from "./types";
import { mealToRecipe, type MealDBFull } from "./mealdb-parse";

export { mealToRecipe, parseFraction, parseMeasure } from "./mealdb-parse";
export type { MealDBFull } from "./mealdb-parse";

const BASE = "https://www.themealdb.com/api/json/v1/1";

export interface MealDBCategory {
  idCategory: string;
  strCategory: string;
  strCategoryThumb: string;
  strCategoryDescription: string;
}

export interface MealDBAreaSummary {
  strArea: string;
}

export interface MealDBCardItem {
  idMeal: string;
  strMeal: string;
  strMealThumb: string;
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`MealDB ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function listCategories(): Promise<MealDBCategory[]> {
  const data = await get<{ categories: MealDBCategory[] }>("/categories.php");
  return data.categories ?? [];
}

export async function listAreas(): Promise<string[]> {
  const data = await get<{ meals: MealDBAreaSummary[] | null }>(
    "/list.php",
    { a: "list" },
  );
  return (data.meals ?? []).map((a) => a.strArea).sort();
}

export async function filterByArea(area: string): Promise<MealDBCardItem[]> {
  const data = await get<{ meals: MealDBCardItem[] | null }>(
    "/filter.php",
    { a: area },
  );
  return data.meals ?? [];
}

export async function filterByCategory(
  category: string,
): Promise<MealDBCardItem[]> {
  const data = await get<{ meals: MealDBCardItem[] | null }>(
    "/filter.php",
    { c: category },
  );
  return data.meals ?? [];
}

export async function searchByName(name: string): Promise<Recipe[]> {
  const data = await get<{ meals: MealDBFull[] | null }>(
    "/search.php",
    { s: name },
  );
  return (data.meals ?? []).map(mealToRecipe);
}

export async function lookupMeal(id: string): Promise<Recipe | null> {
  const data = await get<{ meals: MealDBFull[] | null }>(
    "/lookup.php",
    { i: id },
  );
  const meal = data.meals?.[0];
  return meal ? mealToRecipe(meal) : null;
}

export async function randomMeals(count = 6): Promise<Recipe[]> {
  if (!Number.isInteger(count) || count < 1 || count > 6) throw new Error('Request between one and six random meals.');
  // TheMealDB's /random.php returns 1 meal per call; we do them in parallel.
  const calls = Array.from({ length: count }, () =>
    get<{ meals: MealDBFull[] | null }>("/random.php"),
  );
  // allSettled so one failed call doesn't wipe out the whole "Surprise me".
  const responses = await Promise.allSettled(calls);
  if (responses.every(response => response.status === 'rejected')) throw new Error('World recipes are temporarily unavailable.');
  const recipes = responses
    .flatMap((r) => (r.status === "fulfilled" ? (r.value.meals ?? []) : []))
    .map(mealToRecipe);
  // Dedupe by id (random can collide)
  const seen = new Set<string>();
  return recipes.filter((r) =>
    seen.has(r.id) ? false : (seen.add(r.id), true),
  );
}
