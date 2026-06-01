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
 * network; the query helpers wrap the Supabase client + search RPCs.
 */

import { getSupabase } from "./supabase";
import type { Nutrition } from "./types";

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
  return v === null || v === undefined ? undefined : Number(v);
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

/** Typo-tolerant ingredient search (prefix + full-text + trigram + aliases). */
export async function searchIngredients(
  q: string,
  limit = 20,
): Promise<Ingredient[]> {
  const { data, error } = await getSupabase().rpc("search_ingredients", {
    q,
    lim: limit,
  });
  if (error) throw new Error(error.message);
  return ((data as Record<string, unknown>[]) ?? []).map(ingredientFromRow);
}

/** Look up a branded product by barcode (EAN/UPC). */
export async function lookupFoodByBarcode(
  barcode: string,
): Promise<FoodProduct | null> {
  const { data, error } = await getSupabase()
    .from("foods")
    .select("*")
    .eq("barcode", barcode)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? foodFromRow(data as Record<string, unknown>) : null;
}

/**
 * Precise ingredient lookup by slug or exact name (case-insensitive) — for
 * nutrition resolution, where we want the right row, not a fuzzy best guess.
 */
export async function lookupIngredientByName(
  name: string,
): Promise<Ingredient | null> {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const slug = n.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const { data, error } = await getSupabase()
    .from("ingredients")
    .select("*")
    .or(`slug.eq.${slug},name.ilike.${n}`)
    .limit(1);
  if (error) throw new Error(error.message);
  const rows = (data as Record<string, unknown>[]) ?? [];
  return rows.length ? ingredientFromRow(rows[0]) : null;
}

/** List cooking techniques, optionally filtered by category. */
export async function listTechniques(category?: string): Promise<Technique[]> {
  let query = getSupabase().from("techniques").select("*").order("title");
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data as Record<string, unknown>[]) ?? []).map(techniqueFromRow);
}
