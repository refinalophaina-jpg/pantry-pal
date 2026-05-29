/**
 * TheMealDB v1 (free) — https://www.themealdb.com/api.php
 * No API key required for v1; ratelimited by client behavior.
 * Calls go directly from the browser; CORS is open.
 */

import type { Recipe, UnitType } from "./types";

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

interface MealDBFull {
  idMeal: string;
  strMeal: string;
  strDrinkAlternate: string | null;
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strMealThumb: string;
  strTags: string | null;
  strYoutube: string | null;
  strSource: string | null;
  [key: string]: string | null;
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
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
  // TheMealDB's /random.php returns 1 meal per call; we do them in parallel.
  const calls = Array.from({ length: count }, () =>
    get<{ meals: MealDBFull[] | null }>("/random.php"),
  );
  // allSettled so one failed call doesn't wipe out the whole "Surprise me".
  const responses = await Promise.allSettled(calls);
  const recipes = responses
    .flatMap((r) => (r.status === "fulfilled" ? (r.value.meals ?? []) : []))
    .map(mealToRecipe);
  // Dedupe by id (random can collide)
  const seen = new Set<string>();
  return recipes.filter((r) =>
    seen.has(r.id) ? false : (seen.add(r.id), true),
  );
}

const UNIT_PATTERNS: Array<{ re: RegExp; unit: UnitType; factor: number }> = [
  { re: /\bkg\b/i, unit: "kg", factor: 1 },
  { re: /\bg(?:ram)?s?\b/i, unit: "g", factor: 1 },
  { re: /\bml\b/i, unit: "ml", factor: 1 },
  { re: /\bl(?:iter)?s?\b/i, unit: "l", factor: 1 },
  { re: /\btbsp\b|\btablespoons?\b/i, unit: "tbsp", factor: 1 },
  { re: /\btsp\b|\bteaspoons?\b/i, unit: "tsp", factor: 1 },
  { re: /\bcups?\b/i, unit: "cup", factor: 1 },
];

function parseFraction(str: string): number | null {
  const trimmed = str.trim();
  if (!trimmed) return null;
  // Mixed: "1 1/2"
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  }
  // Simple fraction "1/2"
  const frac = trimmed.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  // Range "1-2" → midpoint
  const range = trimmed.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  // Decimal
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

function parseMeasure(raw: string): { quantity: number; unit: UnitType } {
  const measure = (raw ?? "").trim();
  if (!measure) return { quantity: 1, unit: "pcs" };

  // Detect unit token
  let unit: UnitType = "pcs";
  for (const { re, unit: u } of UNIT_PATTERNS) {
    if (re.test(measure)) {
      unit = u;
      break;
    }
  }

  // Extract numeric prefix
  const numMatch = measure.match(
    /^\s*((?:\d+\s+\d+\/\d+)|(?:\d+\/\d+)|(?:\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)|(?:\.\d+))/,
  );
  const qty = numMatch ? parseFraction(numMatch[1]) : null;
  return { quantity: qty && qty > 0 ? qty : 1, unit };
}

function mealToRecipe(meal: MealDBFull): Recipe {
  const ingredients: Recipe["ingredients"] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] ?? "").trim();
    const measure = (meal[`strMeasure${i}`] ?? "").trim();
    if (!name) continue;
    const parsed = parseMeasure(measure);
    ingredients.push({
      name,
      quantity: parsed.quantity,
      unit: parsed.unit,
    });
  }
  // Split instructions into discrete steps. TheMealDB uses \r\n delimited
  // lines, sometimes numbered, sometimes just sentences.
  const rawSteps = (meal.strInstructions ?? "")
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const steps =
    rawSteps.length > 1
      ? rawSteps
      : (meal.strInstructions ?? "")
          .split(/(?<=[.!?])\s+(?=[A-Z])/)
          .map((s) => s.trim())
          .filter(Boolean);

  const tags = (meal.strTags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // Heuristic difficulty from step count
  const difficulty: Recipe["difficulty"] =
    steps.length >= 9 ? "hard" : steps.length >= 5 ? "medium" : "easy";

  // Heuristic time: 8 min per step capped at 90, floor 15
  const minutes = Math.max(15, Math.min(90, steps.length * 8));

  return {
    id: `mealdb-${meal.idMeal}`,
    externalId: meal.idMeal,
    name: meal.strMeal,
    description: `${meal.strCategory ?? "Recipe"} from ${meal.strArea ?? "around the world"}.`,
    cuisine: meal.strArea ?? "International",
    area: meal.strArea ?? undefined,
    minutes,
    difficulty,
    servings: 4,
    equipment: [],
    ingredients,
    steps,
    tags: tags.length
      ? tags
      : [meal.strCategory ?? "savoury", meal.strArea ?? "world"].filter(Boolean),
    imageUrl: meal.strMealThumb ?? undefined,
    video: meal.strYoutube ?? undefined,
    source: meal.strSource ?? undefined,
  };
}
