import { ingredientName } from "./ingredient-name";

/**
 * Match pantry item names against recipe ingredient names without a network
 * call. Deliberately tolerant on descriptors ("fresh", "large", "chopped") and
 * strict on derived products: "rice" is not "rice noodles", "garlic" is not
 * "garlic powder", "coconut" is not "coconut milk".
 */
const DESCRIPTORS = new Set(["fresh", "raw", "cooked", "dried", "dry", "canned", "tinned", "frozen", "chopped", "sliced", "diced", "minced", "grated", "crushed", "ground", "large", "small", "medium", "ripe", "whole", "boneless", "skinless", "organic", "extra", "virgin", "unsalted", "salted", "plain", "of", "the", "a", "and", "or", "to", "taste", "some", "few", "handful", "pinch", "finely", "roughly", "thinly", "peeled", "roasted", "toasted", "baby", "free", "range", "light", "low", "fat", "full", "half", "big", "little", "hot", "cold", "warm", "cut", "into", "pieces", "for", "serving", "garnish", "optional", "about", "approx"]);
const DERIVED_HEADS = new Set(["noodles", "noodle", "flour", "vinegar", "oil", "sauce", "paste", "powder", "milk", "cream", "butter", "syrup", "juice", "wine", "stock", "broth", "seeds", "seed", "starch", "bread", "crumbs", "breadcrumbs", "extract", "zest", "peel", "skin", "water", "chips", "flakes", "puree", "concentrate", "cheese", "yogurt", "yoghurt", "sugar", "salt", "pepper", "spread", "jam", "jelly", "pickle", "pickles", "wrapper", "wrappers", "sheets", "cake", "pudding", "soup", "mix", "seasoning", "rub", "marinade", "dressing", "liqueur", "beer", "cider", "tea", "coffee"]);
const STAPLES = ["salt", "pepper", "water", "oil", "sugar", "flour", "butter", "vinegar", "garlic", "onion", "soy sauce", "olive oil", "vegetable oil", "black pepper", "sea salt", "cooking oil"];

function singular(word: string) {
  if (word.length <= 3) return word;
  if (/(?:ss|us|is)$/.test(word)) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (/(?:oes|ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("ves")) return `${word.slice(0, -3)}f`;
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/** Lower-cased content words with descriptors removed and plurals folded. */
export function foodTokens(name: string): string[] {
  const base = ingredientName(name.replace(/\(.*?\)/g, " "));
  return base
    .split(/[^a-z0-9]+/i)
    .map(word => singular(word.toLowerCase()))
    .filter(word => word && !DESCRIPTORS.has(word) && !/^\d+$/.test(word));
}

export function foodMatches(pantryName: string, ingredient: string): boolean {
  const a = foodTokens(pantryName);
  const b = foodTokens(ingredient);
  if (!a.length || !b.length) return false;
  if (a.join(" ") === b.join(" ")) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (!shorter.every(token => longer.includes(token))) return false;
  const head = longer[longer.length - 1];
  // A derived product only matches when the shorter name names that product too.
  if (DERIVED_HEADS.has(head) && !shorter.includes(head)) return false;
  return true;
}

export function isStaple(ingredient: string) {
  const normalized = foodTokens(ingredient).join(" ");
  return STAPLES.some(staple => foodTokens(staple).join(" ") === normalized);
}

export interface PantryMatch<T> {
  entry: T;
  have: number;
  total: number;
  /** Share of non-staple ingredients the pantry covers, 0–1. */
  coverage: number;
  matched: string[];
  missing: string[];
}

export function matchAgainstPantry<T extends { ingredients: string[] }>(entry: T, pantryNames: string[]): PantryMatch<T> {
  const considered = entry.ingredients.filter(name => !isStaple(name));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const ingredient of considered) {
    if (pantryNames.some(item => foodMatches(item, ingredient))) matched.push(ingredient);
    else missing.push(ingredient);
  }
  return { entry, have: matched.length, total: considered.length, coverage: considered.length ? matched.length / considered.length : 0, matched, missing };
}

/** Recipes worth cooking now: at least `minMatched` real ingredients on hand, best coverage first. */
export function rankByPantry<T extends { ingredients: string[]; minutes?: number }>(entries: T[], pantryNames: string[], options: { minMatched?: number; limit?: number } = {}): PantryMatch<T>[] {
  const minMatched = options.minMatched ?? 2;
  return entries
    .map(entry => matchAgainstPantry(entry, pantryNames))
    .filter(match => match.have >= minMatched && match.total > 0)
    .sort((a, b) => b.coverage - a.coverage || b.have - a.have || (a.entry.minutes ?? 0) - (b.entry.minutes ?? 0))
    .slice(0, options.limit ?? entries.length);
}
