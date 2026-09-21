import { searchRecipeCatalog } from './food-db';
import { filterByArea, lookupMeal, randomMeals, searchByName } from './mealdb';
import { seedRecipes } from './seed-data';
import type { Recipe } from './types';

// Area names supported by TheMealDB's V1 area list. Local recipes also match here.
export const EXPLORE_CUISINES = ['Vietnamese', 'Thai', 'Nigerian', 'Indian', 'Chinese', 'Italian', 'French', 'Japanese', 'Mexican', 'Greek', 'Moroccan', 'British', 'American'];
export type ExploreView = 'discover' | 'kitchen' | 'world' | string;
export interface ExploreResult { recipes: Recipe[]; notice?: string }

function matches(recipe: Recipe, query: string, cuisine?: string) {
  if (cuisine && recipe.cuisine.toLowerCase() !== cuisine.toLowerCase()) return false;
  const text = [recipe.name, recipe.description, recipe.cuisine, ...recipe.tags, ...recipe.ingredients.map(item => item.name)].join(' ').toLowerCase();
  return query.toLowerCase().split(/\s+/).every(word => text.includes(word));
}

export function bundledExploreRecipes(view: ExploreView = 'discover', query = '') {
  const cuisine = !query && EXPLORE_CUISINES.includes(view) ? view : undefined;
  return seedRecipes.filter(recipe => matches(recipe, query, cuisine));
}

function unique(recipes: Recipe[]) {
  const ids = new Set<string>();
  const names = new Set<string>();
  return recipes.filter(recipe => {
    const name = recipe.name.trim().toLowerCase();
    if (ids.has(recipe.id) || names.has(name)) return false;
    ids.add(recipe.id); names.add(name);
    return true;
  }).map(recipe => ({ ...recipe, source: recipe.source && /^https?:\/\//i.test(recipe.source) ? recipe.source : undefined }));
}

async function worldCuisine(area: string): Promise<ExploreResult> {
  const cards = (await filterByArea(area)).filter(card => /^\d+$/.test(card.idMeal)).slice(0, 12);
  const recipes: Recipe[] = [];
  let missed = 0;
  // Filter responses only contain thumbnails; fetch full ingredients/steps before
  // showing actionable recipes, with at most four concurrent detail requests.
  for (let start = 0; start < cards.length; start += 4) {
    const details = await Promise.allSettled(cards.slice(start, start + 4).map(card => lookupMeal(card.idMeal)));
    for (const result of details) {
      if (result.status === 'fulfilled' && result.value?.ingredients.length && result.value.steps.length) recipes.push(result.value);
      else missed++;
    }
  }
  return { recipes, notice: missed ? 'Some World recipes could not be loaded. The available recipes are shown.' : undefined };
}

/** Discover and Our Kitchen work entirely from D1 plus the bundled collection. */
async function fetchExploreRecipes(view: ExploreView, query = ''): Promise<ExploreResult> {
  const cuisine = !query && EXPLORE_CUISINES.includes(view) ? view : undefined;
  const local = searchRecipeCatalog(query, 100);
  const useWorld = Boolean(query || view === 'world' || cuisine);
  const world: Promise<ExploreResult> = !useWorld ? Promise.resolve({ recipes: [] })
    : query ? searchByName(query).then(recipes => ({ recipes }))
      : cuisine ? worldCuisine(cuisine)
        : randomMeals(6).then(recipes => ({ recipes }));
  const [catalog, external] = await Promise.allSettled([local, world]);
  const notices: string[] = [];
  if (catalog.status === 'rejected') notices.push('Our Kitchen could not be refreshed. Bundled recipes remain available.');
  if (external.status === 'rejected') notices.push('World recipes are temporarily unavailable. Recipes from Our Kitchen are shown where available.');
  else if (external.value.notice) notices.push(external.value.notice);
  const curated = catalog.status === 'fulfilled' ? catalog.value.filter(recipe => matches(recipe, query, cuisine)) : [];
  const remote = external.status === 'fulfilled' ? external.value.recipes.filter(recipe => recipe.ingredients.length && recipe.steps.length) : [];
  return {
    recipes: unique([...curated, ...bundledExploreRecipes(view, query), ...remote]),
    notice: notices.length ? notices.join(' ') : undefined,
  };
}

export function shuffledRecipes(recipes: Recipe[]) {
  const result = [...recipes];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Only public reference content is cached; never household recipes or pantry data.
const exploreCache = new Map<string, { expires: number; value: ExploreResult }>();
const inFlight = new Map<string, Promise<ExploreResult>>();
export function clearExploreCache() { exploreCache.clear(); inFlight.clear(); }
export async function loadExploreRecipes(view: ExploreView, query = ''): Promise<ExploreResult> {
  const key = JSON.stringify([view, query.trim()]);
  const cached = exploreCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const request = fetchExploreRecipes(view, query.trim()).then(value => {
    if (!value.notice) {
      if (exploreCache.size >= 24) exploreCache.delete(exploreCache.keys().next().value!);
      exploreCache.set(key, { expires: Date.now() + 300_000, value });
    }
    return value;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}
