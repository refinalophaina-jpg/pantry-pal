import type { Recipe, UnitType } from "./types";

/**
 * Pure TheMealDB → Recipe mapping, shared by the browser client and the
 * Worker's weekly mirror job. No fetching here.
 */

export interface MealDBFull {
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

const UNIT_PATTERNS: Array<{ re: RegExp; unit: UnitType; factor: number }> = [
  { re: /\bkg\b/i, unit: "kg", factor: 1 },
  { re: /\bg(?:ram)?s?\b/i, unit: "g", factor: 1 },
  { re: /\bml\b/i, unit: "ml", factor: 1 },
  { re: /\bl(?:iter)?s?\b/i, unit: "l", factor: 1 },
  { re: /\btbsp\b|\btablespoons?\b/i, unit: "tbsp", factor: 1 },
  { re: /\btsp\b|\bteaspoons?\b/i, unit: "tsp", factor: 1 },
  { re: /\bcups?\b/i, unit: "cup", factor: 1 },
];

export function parseFraction(str: string): number | null {
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

export function parseMeasure(raw: string): { quantity: number; unit: UnitType } {
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

export function mealToRecipe(meal: MealDBFull): Recipe {
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
