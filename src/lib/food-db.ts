/**
 * Food consortium data-access — the canonical reference layer.
 *
 * Reads the public-read tables added in the food_consortium migration:
 *   - ingredients     (canonical, alias-matched, per-100g nutrition)
 *   - foods           (branded/barcode products)
 *   - techniques      (cooking guides)
 *   - recipe_catalog  (shared recipe corpus)
 *
 * Row mappers are pure and exported so they can be unit-tested without a
 * network; the query helpers use the authenticated Workers API.
 */

import { apiRequest } from "./api-client";
import type { Nutrition, Recipe } from "./types";

export interface Ingredient {
  id: string;
  slug: string;
  name: string;
  category: string;
  aliases: string[];
  densityGPerMl?: number;
  gramsPerPiece?: number;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  source: string;
}

export interface FoodProduct {
  id: string;
  barcode?: string;
  name: string;
  brand?: string;
  category: string;
  ingredientId?: string;
  servingSize?: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  source: string;
}

export interface Technique {
  id: string;
  slug: string;
  title: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  minutes?: number;
  summary: string;
  body: string;
  tags: string[];
}

// snake_case → undefined-safe number
function num(v: unknown): number | undefined {
  return v === null || v === undefined || !Number.isFinite(Number(v)) || Number(v) < 0 ? undefined : Number(v);
}

export function ingredientFromRow(row: Record<string, unknown>): Ingredient {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    category: String(row.category ?? "Other"),
    aliases: (row.aliases as string[]) ?? [],
    densityGPerMl: num(row.density_g_per_ml),
    gramsPerPiece: num(row.grams_per_piece),
    calories: num(row.calories),
    proteinG: num(row.protein_g),
    carbsG: num(row.carbs_g),
    fatG: num(row.fat_g),
    fiberG: num(row.fiber_g),
    source: String(row.source ?? "curated"),
  };
}

export function foodFromRow(row: Record<string, unknown>): FoodProduct {
  return {
    id: String(row.id),
    barcode: row.barcode ? String(row.barcode) : undefined,
    name: String(row.name),
    brand: row.brand ? String(row.brand) : undefined,
    category: String(row.category ?? "Other"),
    ingredientId: row.ingredient_id ? String(row.ingredient_id) : undefined,
    servingSize: row.serving_size ? String(row.serving_size) : undefined,
    calories: num(row.calories),
    proteinG: num(row.protein_g),
    carbsG: num(row.carbs_g),
    fatG: num(row.fat_g),
    fiberG: num(row.fiber_g),
    source: String(row.source ?? "openfoodfacts"),
  };
}

export function techniqueFromRow(row: Record<string, unknown>): Technique {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    category: String(row.category ?? "General"),
    difficulty: (row.difficulty as Technique["difficulty"]) ?? "easy",
    minutes: num(row.minutes),
    summary: String(row.summary ?? ""),
    body: String(row.body ?? ""),
    tags: (row.tags as string[]) ?? [],
  };
}

/** Map a recipe_catalog row onto the app's Recipe type (drop-in for the UI). */
export function catalogRecipeFromRow(row: Record<string, unknown>): Recipe {
  return {
    id: `cat-${String(row.slug)}`,
    name: String(row.name),
    description: String(row.description ?? ""),
    cuisine: String(row.cuisine ?? "International"),
    minutes: Number(row.minutes ?? 30),
    difficulty: (row.difficulty as Recipe["difficulty"]) ?? "medium",
    servings: Number(row.servings ?? 2),
    equipment: (row.equipment as string[]) ?? [],
    ingredients: (row.ingredients as Recipe["ingredients"]) ?? [],
    steps: (row.steps as string[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    imageUrl: row.image_url ? String(row.image_url) : undefined,
    area: row.area ? String(row.area) : undefined,
    source: row.source ? String(row.source) : undefined,
    externalId: `cat-${String(row.slug)}`,
    calories: num(row.calories),
    proteinG: num(row.protein_g),
    carbsG: num(row.carbs_g),
    fatG: num(row.fat_g),
  };
}

/** Per-100g nutrition for an ingredient, or null if it carries no data. */
export function ingredientNutrition(ing: Ingredient): Nutrition | null {
  if (ing.calories === undefined) return null;
  return {
    calories: ing.calories,
    proteinG: ing.proteinG,
    carbsG: ing.carbsG,
    fatG: ing.fatG,
    fiberG: ing.fiberG,
  };
}

// ---- Queries -------------------------------------------------------------

/** Bounded ingredient search through the shared catalog. */
export async function searchIngredients(q: string, limit = 20): Promise<Ingredient[]> {
  const { data } = await apiRequest<{ data: Record<string, unknown>[] }>(`/api/catalog/ingredients?${new URLSearchParams({ q, limit: String(limit) })}`);
  return data.map(ingredientFromRow);
}

export async function searchRecipeCatalog(q: string, limit = 20): Promise<Recipe[]> {
  const { data } = await apiRequest<{ data: Record<string, unknown>[] }>(`/api/catalog/recipes?${new URLSearchParams({ q, limit: String(limit) })}`);
  return data.map(catalogRecipeFromRow);
}

export async function lookupFoodByBarcode(barcode: string): Promise<FoodProduct | null> {
  const { data } = await apiRequest<{ data: Record<string, unknown> | null }>(`/api/catalog/foods?${new URLSearchParams({ barcode })}`);
  return data ? foodFromRow(data) : null;
}

/** Exact name/slug lookup, never a guessed fuzzy nutrition match. */
export async function lookupIngredientByName(name: string): Promise<Ingredient | null> {
  if (!name.trim()) return null;
  const { data } = await apiRequest<{ data: Record<string, unknown> | null }>(`/api/catalog/ingredients?${new URLSearchParams({ name: name.trim().toLowerCase() })}`);
  return data ? ingredientFromRow(data) : null;
}

export async function listTechniques(category?: string): Promise<Technique[]> {
  const { data } = await apiRequest<{ data: Record<string, unknown>[] }>(`/api/catalog/techniques${category ? `?${new URLSearchParams({ category })}` : ""}`);
  return data.map(techniqueFromRow);
}
