import type { Recipe, UnitType } from "./types";

/** Pure Spoonacular → Recipe mapping, shared by the client and the Worker cache. */

const UNIT_MAP: Record<string, UnitType> = {
  gram: "g", grams: "g", g: "g",
  kilogram: "kg", kilograms: "kg", kg: "kg",
  milliliter: "ml", milliliters: "ml", ml: "ml",
  liter: "l", liters: "l", l: "l",
  tablespoon: "tbsp", tablespoons: "tbsp", tbsp: "tbsp", tbsps: "tbsp",
  teaspoon: "tsp", teaspoons: "tsp", tsp: "tsp", tsps: "tsp",
  cup: "cup", cups: "cup",
};

export function mapUnit(u?: string): UnitType {
  if (!u) return "pcs";
  return UNIT_MAP[u.toLowerCase().trim()] ?? "pcs";
}

export function stripHtml(s?: string): string {
  return (s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export interface SpoonResult {
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

export function toRecipe(r: SpoonResult): Recipe {
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
