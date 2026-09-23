import { clearRecipeIndexCache, fetchCatalogRecipe, loadRecipeIndex, readCachedIndex, type CatalogEntry } from "./catalog-index";
import { prepRecipes } from "./prep-recipes";
import { seedRecipes } from "./seed-data";
import type { Recipe } from "./types";

/**
 * Explore reads one slim catalog index plus the bundled kitchen recipes, so
 * searching, cuisine chips and pantry matching are instant. A card resolves
 * to a full recipe only when it is opened.
 */
export interface ExploreCard {
  id: string;
  slug?: string;
  name: string;
  cuisine: string;
  minutes: number;
  difficulty: Recipe["difficulty"];
  servings: number;
  imageUrl?: string;
  source: string;
  tags: string[];
  ingredients: string[];
  recipe?: Recipe;
}

/** Cuisines the household asked for first; the rest come from what the catalog holds. */
export const EXPLORE_CUISINES = ["Vietnamese", "Thai", "Nigerian", "Indian", "Chinese", "Japanese", "Italian", "Mexican", "Greek", "Moroccan", "French", "British", "American"];

export function cardFromRecipe(recipe: Recipe, source = "kitchen"): ExploreCard {
  return {
    id: recipe.id, name: recipe.name, cuisine: recipe.cuisine || "International", minutes: recipe.minutes, difficulty: recipe.difficulty, servings: recipe.servings,
    imageUrl: recipe.imageUrl, source, tags: recipe.tags, ingredients: recipe.ingredients.filter(item => !item.optional).map(item => item.name), recipe,
  };
}

export function cardFromEntry(entry: CatalogEntry): ExploreCard {
  return { id: `cat-${entry.slug}`, slug: entry.slug, name: entry.name, cuisine: entry.cuisine || "International", minutes: entry.minutes, difficulty: entry.difficulty, servings: entry.servings, imageUrl: entry.imageUrl, source: entry.source, tags: entry.tags, ingredients: entry.ingredients };
}

/** One card per dish: the first occurrence wins, so the household's own copy beats the catalog's. */
export function uniqueCards(cards: ExploreCard[]): ExploreCard[] {
  const ids = new Set<string>();
  const names = new Set<string>();
  return cards.filter(card => {
    const name = card.name.trim().toLowerCase();
    if (ids.has(card.id) || names.has(name)) return false;
    ids.add(card.id); names.add(name);
    return true;
  });
}

export function bundledCards(): ExploreCard[] {
  return uniqueCards([...seedRecipes, ...prepRecipes].map(recipe => cardFromRecipe(recipe)));
}

export function searchCards(cards: ExploreCard[], query: string, cuisine?: string): ExploreCard[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const wanted = cuisine?.toLowerCase();
  return cards.filter(card => {
    if (wanted && card.cuisine.toLowerCase() !== wanted) return false;
    if (!words.length) return true;
    const haystack = [card.name, card.cuisine, ...card.tags, ...card.ingredients].join(" ").toLowerCase();
    return words.every(word => haystack.includes(word));
  });
}

export function cuisineCounts(cards: ExploreCard[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const name = card.cuisine || "International";
    if (name === "International" || name === "Custom" || name === "Unknown") continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      const ai = EXPLORE_CUISINES.indexOf(a.name); const bi = EXPLORE_CUISINES.indexOf(b.name);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return b.count - a.count || a.name.localeCompare(b.name);
    });
}

export function shuffledCards<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function clearExploreCache() { clearRecipeIndexCache(); }

/** Whatever this device already holds, for the first paint. */
export function cachedExploreCards(): ExploreCard[] {
  const cached = readCachedIndex();
  return uniqueCards([...bundledCards(), ...(cached ?? []).map(cardFromEntry)]);
}

export async function loadExploreCards(options: { force?: boolean } = {}): Promise<{ cards: ExploreCard[]; notice?: string }> {
  try {
    const index = await loadRecipeIndex(options);
    return { cards: uniqueCards([...bundledCards(), ...index.map(cardFromEntry)]) };
  } catch {
    const cached = readCachedIndex();
    return {
      cards: uniqueCards([...bundledCards(), ...(cached ?? []).map(cardFromEntry)]),
      notice: cached ? "The catalog could not be refreshed. Showing the last copy saved on this device." : "The shared catalog could not be loaded. Bundled kitchen recipes are shown.",
    };
  }
}

export async function resolveCard(card: ExploreCard): Promise<Recipe> {
  if (card.recipe) return card.recipe;
  if (!card.slug) throw new Error("This recipe is unavailable. Please retry.");
  const recipe = await fetchCatalogRecipe(card.slug);
  if (!recipe) throw new Error("This recipe is no longer in the catalog.");
  return recipe;
}
