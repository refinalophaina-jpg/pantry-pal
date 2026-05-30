import { getSupabase } from "./supabase";
import type { Recipe, UnitType } from "./types";

/**
 * Spoonacular recipe search, proxied through the `recipe-search` Edge Function
 * (the API key stays server-side). Results are mapped onto our Recipe type so
 * the rest of the app (RecipeDetail, save, pantry matching) works unchanged.
 */

const UNIT_MAP: Record<string, UnitType> = {
  gram: "g", grams: "g", g: "g",
  kilogram: "kg", kilograms: "kg", kg: "kg",
  milliliter: "ml", milliliters: "ml", ml: "ml",
  liter: "l", liters: "l", l: "l",
  tablespoon: "tbsp", tablespoons: "tbsp", tbsp: "tbsp", tbsps: "tbsp",
  teaspoon: "tsp", teaspoons: "tsp", tsp: "tsp", tsps: "tsp",
  cup: "cup", cups: "cup",
};

function mapUnit(u?: string): UnitType {
  if (!u) return "pcs";
  return UNIT_MAP[u.toLowerCase().trim()] ?? "pcs";
}

function stripHtml(s?: string): string {
  return (s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

interface SpoonResult {
  id: number;
  title: string;
  image?: string;
  readyInMinutes?: number;
  servings?: number;
  cuisines?: string[];
  dishTypes?: string[];
  diets?: string[];
  summary?: string;
  sourceUrl?: string;
  extendedIngredients?: Array<{
    nameClean?: string;
    name?: string;
    amount?: number;
    unit?: string;
  }>;
  analyzedInstructions?: Array<{ steps: Array<{ step: string }> }>;
}

function toRecipe(r: SpoonResult): Recipe {
  const minutes = r.readyInMinutes ?? 30;
  const steps = (r.analyzedInstructions?.[0]?.steps ?? [])
    .map((s) => s.step)
    .filter(Boolean);
  const firstSentence = stripHtml(r.summary).split(". ")[0];
  return {
    id: `sp-${r.id}`,
    name: r.title,
    description: firstSentence
      ? `${firstSentence}.`
      : (r.dishTypes?.[0] ?? "A recipe from Spoonacular."),
    cuisine: r.cuisines?.[0] ?? "International",
    minutes,
    difficulty: minutes <= 20 ? "easy" : minutes <= 45 ? "medium" : "hard",
    servings: r.servings ?? 2,
    equipment: [],
    ingredients: (r.extendedIngredients ?? []).map((i) => ({
      name: i.nameClean || i.name || "ingredient",
      quantity: i.amount && i.amount > 0 ? Math.round(i.amount * 100) / 100 : 1,
      unit: mapUnit(i.unit),
    })),
    steps: steps.length
      ? steps
      : ["Open the source link below for the full instructions."],
    tags: Array.from(
      new Set([...(r.diets ?? []), ...(r.dishTypes ?? [])]),
    ).slice(0, 6),
    imageUrl: r.image,
    source: r.sourceUrl,
    externalId: `sp-${r.id}`,
  };
}

async function call(body: Record<string, unknown>): Promise<Recipe[]> {
  const { data, error } = await getSupabase().functions.invoke("recipe-search", {
    body,
  });
  if (error) throw new Error(error.message || "Recipe search failed.");
  if (data?.error) throw new Error(data.error);
  return ((data?.items ?? []) as SpoonResult[]).map(toRecipe);
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
