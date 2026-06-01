/**
 * Nutrition lookup.
 *
 * Strategy:
 * 1. Try a small built-in table (no network, instant).
 * 2. Fall back to Supabase `nutrition_cache` (shared across households).
 * 3. (Future) Fall back to USDA FoodData Central with API key.
 *
 * Values are expressed per 100 g (or per 100 ml for liquids; we treat them
 * the same since most ingredients are close to 1 g/ml at low precision).
 */

import type { Recipe, UnitType, Nutrition } from "./types";
import { getSupabase } from "./supabase";
import { lookupIngredientByName } from "./food-db";

interface Per100 extends Nutrition {
  /** Treat per_unit as 'piece' rather than '100g' (e.g. for eggs). */
  perPiece?: boolean;
  /** Approximate grams per "1 pcs" — used when recipe quantity is in pcs. */
  gramsPerPiece?: number;
}

// Per 100 g unless noted. Numbers from USDA FoodData Central rounded.
const BUILTIN: Record<string, Per100> = {
  "olive oil": { calories: 884, fatG: 100 },
  butter: { calories: 717, fatG: 81, proteinG: 0.9 },
  egg: { calories: 155, proteinG: 13, fatG: 11, perPiece: true, gramsPerPiece: 50 },
  eggs: { calories: 155, proteinG: 13, fatG: 11, perPiece: true, gramsPerPiece: 50 },
  "chicken breast": { calories: 165, proteinG: 31, fatG: 3.6 },
  "ground beef": { calories: 254, proteinG: 26, fatG: 17 },
  beef: { calories: 250, proteinG: 26, fatG: 15 },
  salmon: { calories: 208, proteinG: 20, fatG: 13 },
  shrimp: { calories: 99, proteinG: 24, fatG: 0.3 },
  tuna: { calories: 132, proteinG: 28, fatG: 1 },
  rice: { calories: 130, proteinG: 2.7, carbsG: 28, fiberG: 0.4 },
  pasta: { calories: 158, proteinG: 5.8, carbsG: 31 },
  spaghetti: { calories: 158, proteinG: 5.8, carbsG: 31 },
  bread: { calories: 265, proteinG: 9, carbsG: 49 },
  flour: { calories: 364, proteinG: 10, carbsG: 76 },
  sugar: { calories: 387, carbsG: 100 },
  milk: { calories: 42, proteinG: 3.4, fatG: 1, carbsG: 5 },
  "whole milk": { calories: 60, proteinG: 3.2, fatG: 3.3, carbsG: 4.6 },
  yogurt: { calories: 59, proteinG: 10, fatG: 0.4, carbsG: 3.6 },
  "greek yogurt": { calories: 59, proteinG: 10, fatG: 0.4, carbsG: 3.6 },
  cheese: { calories: 402, proteinG: 25, fatG: 33 },
  parmesan: { calories: 392, proteinG: 35, fatG: 26 },
  cheddar: { calories: 403, proteinG: 25, fatG: 33 },
  mozzarella: { calories: 280, proteinG: 28, fatG: 17 },
  potato: { calories: 77, carbsG: 17, fiberG: 2.2, perPiece: true, gramsPerPiece: 150 },
  onion: { calories: 40, carbsG: 9, fiberG: 1.7, perPiece: true, gramsPerPiece: 110 },
  garlic: { calories: 149, carbsG: 33, perPiece: true, gramsPerPiece: 3 },
  tomato: { calories: 18, carbsG: 3.9, perPiece: true, gramsPerPiece: 120 },
  "canned tomatoes": { calories: 32, carbsG: 7.3, perPiece: true, gramsPerPiece: 400 },
  carrot: { calories: 41, carbsG: 10, fiberG: 2.8, perPiece: true, gramsPerPiece: 60 },
  spinach: { calories: 23, proteinG: 2.9, carbsG: 3.6, fiberG: 2.2 },
  kale: { calories: 49, proteinG: 4.3, carbsG: 9 },
  broccoli: { calories: 34, proteinG: 2.8, carbsG: 7 },
  "bell pepper": { calories: 31, carbsG: 6, perPiece: true, gramsPerPiece: 150 },
  pepper: { calories: 31, carbsG: 6, perPiece: true, gramsPerPiece: 150 },
  mushroom: { calories: 22, proteinG: 3.1, carbsG: 3.3 },
  apple: { calories: 52, carbsG: 14, perPiece: true, gramsPerPiece: 180 },
  banana: { calories: 89, carbsG: 23, perPiece: true, gramsPerPiece: 120 },
  lemon: { calories: 29, carbsG: 9, perPiece: true, gramsPerPiece: 60 },
  lime: { calories: 30, carbsG: 11, perPiece: true, gramsPerPiece: 50 },
  beans: { calories: 127, proteinG: 8.7, carbsG: 23, fiberG: 6 },
  "black beans": { calories: 132, proteinG: 8.9, carbsG: 24, fiberG: 8.7 },
  lentils: { calories: 116, proteinG: 9, carbsG: 20, fiberG: 7.9 },
  chickpeas: { calories: 164, proteinG: 8.9, carbsG: 27, fiberG: 7.6 },
  almonds: { calories: 579, proteinG: 21, fatG: 50, fiberG: 12 },
  walnuts: { calories: 654, proteinG: 15, fatG: 65 },
  peanuts: { calories: 567, proteinG: 26, fatG: 49 },
  "peanut butter": { calories: 588, proteinG: 25, fatG: 50, carbsG: 20 },
  honey: { calories: 304, carbsG: 82 },
  "maple syrup": { calories: 260, carbsG: 67 },
  "soy sauce": { calories: 53, proteinG: 8 },
  vinegar: { calories: 18, carbsG: 0.9 },
  salt: { calories: 0 },
  pepper_spice: { calories: 251, carbsG: 64 },
  oil: { calories: 884, fatG: 100 },
  "frozen peas": { calories: 81, proteinG: 5.4, carbsG: 14, fiberG: 5.1 },
  peas: { calories: 81, proteinG: 5.4, carbsG: 14, fiberG: 5.1 },
};

// Rough volume → mass conversions (g). Used when ingredient quantity is in
// tsp/tbsp/cup but our nutrition data is per 100g.
const VOLUME_TO_GRAMS_DEFAULT: Record<UnitType, number> = {
  tsp: 5,
  tbsp: 15,
  cup: 240,
  ml: 1,
  l: 1000,
  g: 1,
  kg: 1000,
  pcs: 100, // fallback when we don't know piece weight
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(fresh|dried|chopped|sliced|minced|grated|raw|cooked)\s+/g, "")
    .replace(/\s+\(.*\)$/, "")
    .trim();
}

// Plural → singular candidates. Naive English rules, ordered most→least
// specific so "tomatoes"→"tomato" wins over the bare "-s" strip "tomatoe".
function singularForms(n: string): string[] {
  const forms: string[] = [];
  if (n.endsWith("oes")) forms.push(n.slice(0, -2)); // tomatoes -> tomato
  if (n.endsWith("ies")) forms.push(n.slice(0, -3) + "y"); // berries -> berry
  if (n.endsWith("es")) forms.push(n.slice(0, -2)); // boxes -> box
  if (n.endsWith("s")) forms.push(n.slice(0, -1)); // eggs -> egg
  return forms;
}

function builtinLookup(name: string): Per100 | null {
  const n = normalize(name);
  if (BUILTIN[n]) return BUILTIN[n];
  // Plural → singular (handles -s, -es, -oes, -ies).
  for (const s of singularForms(n)) {
    if (BUILTIN[s]) return BUILTIN[s];
  }
  // Singular → plural (a few table entries are stored only in plural form).
  if (BUILTIN[n + "s"]) return BUILTIN[n + "s"];
  // Last-word match: "olive oil" -> "oil" if we have it
  const last = n.split(" ").pop()!;
  if (BUILTIN[last]) return BUILTIN[last];
  return null;
}

interface CacheRow {
  key: string;
  display_name: string;
  source: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
}

async function cacheLookup(name: string): Promise<Per100 | null> {
  const key = normalize(name);
  const { data } = await getSupabase()
    .from("nutrition_cache")
    .select("*")
    .eq("key", key)
    .maybeSingle();
  if (!data) return null;
  const row = data as CacheRow;
  return {
    calories: Number(row.calories),
    proteinG: row.protein_g ?? undefined,
    carbsG: row.carbs_g ?? undefined,
    fatG: row.fat_g ?? undefined,
    fiberG: row.fiber_g ?? undefined,
  };
}

// The canonical `ingredients` table (food consortium) — richer than the tiny
// builtin table, and it carries conversion factors (grams_per_piece).
async function dbIngredientLookup(name: string): Promise<Per100 | null> {
  const ing = await lookupIngredientByName(name).catch(() => null);
  if (!ing || ing.calories === undefined) return null;
  return {
    calories: ing.calories,
    proteinG: ing.proteinG,
    carbsG: ing.carbsG,
    fatG: ing.fatG,
    fiberG: ing.fiberG,
    gramsPerPiece: ing.gramsPerPiece,
    perPiece: ing.gramsPerPiece !== undefined,
  };
}

/**
 * Best-effort nutrition lookup. Tries fastest/most-trusted first:
 * builtin (instant, offline) → canonical ingredients DB → shared cache.
 */
export async function lookupNutrition(name: string): Promise<Per100 | null> {
  return (
    builtinLookup(name) ??
    (await dbIngredientLookup(name)) ??
    (await cacheLookup(name))
  );
}

function toGrams(
  quantity: number,
  unit: UnitType,
  per: Per100 | null,
): number {
  if (unit === "pcs") {
    return quantity * (per?.gramsPerPiece ?? VOLUME_TO_GRAMS_DEFAULT.pcs);
  }
  return quantity * VOLUME_TO_GRAMS_DEFAULT[unit];
}

export interface RecipeNutrition extends Nutrition {
  knownIngredients: number;
  totalIngredients: number;
  perServing: Nutrition;
}

export async function estimateRecipeNutrition(
  recipe: Recipe,
): Promise<RecipeNutrition> {
  let cal = 0,
    prot = 0,
    carb = 0,
    fat = 0,
    fib = 0,
    known = 0;
  const required = recipe.ingredients.filter((i) => !i.optional);
  // Look ingredients up in parallel; a failed/missing lookup just contributes
  // nothing rather than rejecting the whole estimate.
  const pers = await Promise.all(
    required.map((ing) => lookupNutrition(ing.name).catch(() => null)),
  );
  required.forEach((ing, idx) => {
    const per = pers[idx];
    if (!per) return;
    known++;
    const grams = toGrams(ing.quantity, ing.unit, per);
    const factor = grams / 100;
    cal += per.calories * factor;
    if (per.proteinG) prot += per.proteinG * factor;
    if (per.carbsG) carb += per.carbsG * factor;
    if (per.fatG) fat += per.fatG * factor;
    if (per.fiberG) fib += per.fiberG * factor;
  });
  const servings = Math.max(1, recipe.servings || 1);
  return {
    calories: Math.round(cal),
    proteinG: Math.round(prot),
    carbsG: Math.round(carb),
    fatG: Math.round(fat),
    fiberG: Math.round(fib),
    knownIngredients: known,
    totalIngredients: recipe.ingredients.filter((i) => !i.optional).length,
    perServing: {
      calories: Math.round(cal / servings),
      proteinG: Math.round(prot / servings),
      carbsG: Math.round(carb / servings),
      fatG: Math.round(fat / servings),
      fiberG: Math.round(fib / servings),
    },
  };
}
