/**
 * Barcode → product resolution.
 *
 * ZXing decodes the number; this module names it and pulls its nutrition
 * facts. Strategy mirrors the consortium philosophy:
 *   1. Our own `foods` catalog (imported from Open Food Facts — instant,
 *      works offline-ish, no third-party traffic).
 *   2. The live Open Food Facts API — covers products added to OFF after our
 *      last import, so brand-new products still resolve.
 *
 * Pure mappers are exported for unit tests; only `lookupProduct` touches the
 * network.
 */

import { lookupFoodByBarcode, type FoodProduct } from "./food-db";

/** Per-100g facts as printed on a label (all optional — OFF data is sparse). */
export interface ProductNutrition {
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  saturatedFatG?: number;
  sugarsG?: number;
  fiberG?: number;
  sodiumMg?: number;
}

export interface ScannedProduct {
  name: string;
  category: string;
  servingSize?: string;
  /** Per 100 g / 100 ml. */
  nutrition?: ProductNutrition;
  /** Open Food Facts Nutri-Score grade (a–e), when known. */
  nutriScore?: string;
  source: "catalog" | "openfoodfacts" | "manual";
}

// Map Open Food Facts category tags onto our pantry categories.
const OFF_CATEGORY_RULES: Array<[RegExp, string]> = [
  [/dairy|milk|cheese|yogurt|butter|cream/i, "Dairy"],
  [/beverage|drink|water|juice|soda|coffee|tea/i, "Beverages"],
  [/snack|chip|crisp|cracker|cookie|candy|chocolate|biscuit/i, "Snacks"],
  [/meat|poultry|chicken|beef|pork|fish|seafood|sausage|tofu|legume|bean/i, "Protein"],
  [/vegetable|fruit|produce|salad/i, "Produce"],
  [/cereal|pasta|rice|bread|grain|flour|noodle/i, "Grains"],
  [/frozen/i, "Frozen"],
  [/sauce|condiment|spread|ketchup|mustard|mayonnaise|vinegar/i, "Condiments"],
  [/oil|olive/i, "Oils"],
];

export function bucketForCategory(text: string): string {
  return OFF_CATEGORY_RULES.find(([re]) => re.test(text))?.[1] ?? "Other";
}

// OFF nutriment values are "number-ish" (numbers, numeric strings, or absent).
function n(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
}

/**
 * Map an Open Food Facts `nutriments` object to per-100g label facts.
 * Falls back from kcal to kJ (÷ 4.184) when only `energy_100g` is present.
 */
export function nutritionFromOffNutriments(
  nutriments: Record<string, unknown> | undefined,
): ProductNutrition | undefined {
  if (!nutriments) return undefined;
  const kcal =
    n(nutriments["energy-kcal_100g"]) ??
    (n(nutriments["energy_100g"]) !== undefined
      ? Math.round((n(nutriments["energy_100g"]) as number) / 4.184)
      : undefined);
  const sodiumG = n(nutriments["sodium_100g"]);
  const facts: ProductNutrition = {
    calories: kcal,
    proteinG: n(nutriments["proteins_100g"]),
    carbsG: n(nutriments["carbohydrates_100g"]),
    fatG: n(nutriments["fat_100g"]),
    saturatedFatG: n(nutriments["saturated-fat_100g"]),
    sugarsG: n(nutriments["sugars_100g"]),
    fiberG: n(nutriments["fiber_100g"]),
    sodiumMg: sodiumG !== undefined ? Math.round(sodiumG * 1000) : undefined,
  };
  // All-empty → treat as "no data" so the UI can skip the panel.
  return Object.values(facts).some((v) => v !== undefined) ? facts : undefined;
}

/** Map a `foods` catalog row to a ScannedProduct. */
export function scannedFromCatalog(food: FoodProduct): ScannedProduct {
  const name =
    [food.brand, food.name].filter(Boolean).join(" ").trim() || food.name;
  const facts: ProductNutrition = {
    calories: food.calories,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
    fiberG: food.fiberG,
  };
  const hasFacts = Object.values(facts).some((v) => v !== undefined);
  return {
    name,
    category: bucketForCategory(`${food.category} ${food.name}`),
    servingSize: food.servingSize,
    nutrition: hasFacts ? facts : undefined,
    source: "catalog",
  };
}

interface OffProduct {
  product_name?: string;
  brands?: string;
  categories_tags?: string[];
  serving_size?: string;
  nutriscore_grade?: string;
  nutriments?: Record<string, unknown>;
}

/** Map a live Open Food Facts API product to a ScannedProduct (null if unnamed). */
export function scannedFromOff(p: OffProduct): ScannedProduct | null {
  const name = [p.brands?.split(",")[0]?.trim(), p.product_name?.trim()]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!name) return null;
  const grade = p.nutriscore_grade?.toLowerCase();
  return {
    name,
    category: bucketForCategory((p.categories_tags ?? []).join(" ")),
    servingSize: p.serving_size?.trim() || undefined,
    nutrition: nutritionFromOffNutriments(p.nutriments),
    nutriScore: grade && /^[a-e]$/.test(grade) ? grade : undefined,
    source: "openfoodfacts",
  };
}

const OFF_FIELDS =
  "product_name,brands,categories_tags,serving_size,nutriscore_grade,nutriments";

/**
 * Resolve a scanned UPC/EAN to a product with nutrition facts. Returns null
 * when unknown so the UI can offer manual entry.
 */
export async function lookupProduct(
  code: string,
): Promise<ScannedProduct | null> {
  // 1) Our own catalog first.
  try {
    const food = await lookupFoodByBarcode(code);
    if (food) {
      const scanned = scannedFromCatalog(food);
      // The catalog import may predate nutrition columns — if it has no
      // facts, let the live API fill them in rather than show an empty panel.
      if (scanned.nutrition) return scanned;
      const live = await fetchOffProduct(code);
      return live ? { ...live, source: "openfoodfacts" } : scanned;
    }
  } catch {
    // fall through to the live API
  }
  // 2) Live Open Food Facts — covers products newer than our last import.
  return fetchOffProduct(code);
}

async function fetchOffProduct(code: string): Promise<ScannedProduct | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        code,
      )}.json?fields=${OFF_FIELDS}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    return scannedFromOff(data.product as OffProduct);
  } catch {
    return null;
  }
}
