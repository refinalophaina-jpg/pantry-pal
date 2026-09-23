import type { CatalogEntry } from "./catalog-index";
import { matchAgainstPantry } from "./pantry-match";
import type { Recipe } from "./types";

/**
 * "What kind of week?" turns a few taps into a brief the planner can act on,
 * and a candidate pool drawn from the household's own recipes, the catalog
 * and any assistant drafts, ranked by what the pantry already covers.
 */
export interface WeekMood { id: string; label: string; brief: string }
export const WEEK_MOODS: WeekMood[] = [
  { id: "light", label: "Light & fibre-rich", brief: "Mostly vegetables, legumes and whole grains; high in fibre; lighter dinners." },
  { id: "quick", label: "Quick weeknights", brief: "Every dinner ready in about 35 minutes with little cleanup." },
  { id: "comfort", label: "Comfort food", brief: "Hearty, warming dishes: stews, noodles, rice bowls." },
  { id: "useup", label: "Use up the fridge", brief: "Prioritise pantry foods that expire soonest and keep new shopping small." },
  { id: "budget", label: "Budget-friendly", brief: "Cheap staples: beans, eggs, seasonal vegetables; dishes that batch well." },
  { id: "new", label: "Try something new", brief: "Dishes we have not cooked before, from varied world cuisines." },
];

export const CUISINE_GROUPS: Array<{ label: string; cuisines: string[] }> = [
  { label: "Southeast Asian", cuisines: ["Vietnamese", "Thai", "Malaysian", "Filipino"] },
  { label: "East Asian", cuisines: ["Chinese", "Japanese", "Korean"] },
  { label: "South Asian", cuisines: ["Indian", "Pakistani"] },
  { label: "African", cuisines: ["Nigerian", "Moroccan", "Egyptian", "Kenyan", "Tunisian"] },
  { label: "Mediterranean", cuisines: ["Italian", "Greek", "Spanish", "Turkish", "French", "Portuguese"] },
  { label: "Americas", cuisines: ["Mexican", "American", "Jamaican", "Canadian"] },
  { label: "British & Irish", cuisines: ["British", "Irish"] },
];

export function composeBrief(input: { moods: string[]; cuisines: string[]; notes: string }): string {
  const parts: string[] = [];
  const moods = WEEK_MOODS.filter(mood => input.moods.includes(mood.id)).map(mood => mood.brief);
  if (moods.length) parts.push(moods.join(" "));
  if (input.cuisines.length) parts.push(input.cuisines.length === 1 ? `All ${input.cuisines[0]} dishes.` : `A mix of ${input.cuisines.slice(0, -1).join(", ")} and ${input.cuisines[input.cuisines.length - 1]} dishes.`);
  if (input.notes.trim()) parts.push(input.notes.trim());
  return parts.join(" ").slice(0, 600);
}

export interface PlanCandidate {
  id: string;
  name: string;
  cuisine: string;
  minutes: number;
  tags: string[];
  coverage: number;
  source: "own" | "catalog" | "draft";
  recipe?: Recipe;
  entry?: CatalogEntry;
}

function recipeCandidate(recipe: Recipe, pantryNames: string[], source: "own" | "draft"): PlanCandidate {
  const match = matchAgainstPantry({ ingredients: recipe.ingredients.filter(item => !item.optional).map(item => item.name) }, pantryNames);
  return { id: recipe.id, name: recipe.name, cuisine: recipe.cuisine, minutes: recipe.minutes, tags: recipe.tags.slice(0, 12), coverage: Math.round(match.coverage * 100) / 100, source, recipe };
}

/**
 * Own recipes always qualify. Catalog entries are filtered by the chosen
 * cuisines when any are chosen, ranked by pantry coverage, then interleaved
 * by cuisine so the planner sees variety rather than one region's top 100.
 */
export function candidatePool(input: { own: Recipe[]; drafts?: Recipe[]; index: CatalogEntry[]; pantryNames: string[]; cuisines: string[]; includeCatalog: boolean; limit?: number }): PlanCandidate[] {
  const limit = input.limit ?? 120;
  const seen = new Set<string>();
  const pool: PlanCandidate[] = [];
  for (const recipe of [...input.own, ...(input.drafts ?? [])]) {
    const key = recipe.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(recipeCandidate(recipe, input.pantryNames, input.drafts?.includes(recipe) ? "draft" : "own"));
  }
  if (!input.includeCatalog) return pool.slice(0, limit);
  const wanted = new Set(input.cuisines.map(cuisine => cuisine.toLowerCase()));
  const catalog = input.index
    .filter(entry => entry.ingredients.length >= 3 && (!wanted.size || wanted.has(entry.cuisine.toLowerCase())))
    .filter(entry => { const key = entry.name.trim().toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; })
    .map(entry => {
      const match = matchAgainstPantry(entry, input.pantryNames);
      return { id: `cat-${entry.slug}`, name: entry.name, cuisine: entry.cuisine, minutes: entry.minutes, tags: entry.tags.slice(0, 12), coverage: Math.round(match.coverage * 100) / 100, source: "catalog" as const, entry };
    })
    .sort((a, b) => b.coverage - a.coverage || a.minutes - b.minutes);
  const byCuisine = new Map<string, PlanCandidate[]>();
  for (const candidate of catalog) byCuisine.set(candidate.cuisine, [...(byCuisine.get(candidate.cuisine) ?? []), candidate]);
  const queues = [...byCuisine.values()];
  while (pool.length < limit && queues.some(queue => queue.length)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next) pool.push(next);
      if (pool.length >= limit) break;
    }
  }
  return pool;
}
