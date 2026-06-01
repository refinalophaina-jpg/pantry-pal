#!/usr/bin/env node
/**
 * Import canonical ingredients from USDA FoodData Central into public.ingredients.
 *
 * USDA FDC data is public domain. Nutrients are normalised to per-100 g.
 *
 * Env:
 *   SUPABASE_URL                 your project URL
 *   SUPABASE_SERVICE_ROLE_KEY    service role key (bypasses RLS — server only!)
 *   FDC_API_KEY                  https://fdc.nal.usda.gov/api-key-signup.html
 *
 * Usage:
 *   node scripts/import-usda.mjs               # a curated common-foods list
 *   node scripts/import-usda.mjs rice "olive oil" spinach
 *
 * Idempotent: upserts on the `slug` unique key.
 */
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FDC_API_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FDC_API_KEY) {
  console.error(
    "Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FDC_API_KEY",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// FDC nutrient numbers → our columns (all per 100 g for Foundation/SR foods).
const NUTRIENT = { calories: 1008, protein_g: 1003, fat_g: 1004, carbs_g: 1005, fiber_g: 1079 };

const DEFAULT_QUERIES = [
  "rice", "brown rice", "quinoa", "oats", "barley", "couscous",
  "chicken breast", "ground beef", "pork", "tofu", "salmon", "cod", "tuna", "shrimp",
  "broccoli", "cauliflower", "kale", "cabbage", "zucchini", "cucumber", "mushroom",
  "apple", "orange", "strawberry", "blueberry", "avocado", "mango",
  "cheddar cheese", "mozzarella", "parmesan", "cream", "sour cream",
  "kidney beans", "pinto beans", "cashews", "walnuts", "sunflower seeds",
  "coconut oil", "sesame oil", "maple syrup", "ketchup", "mustard",
];

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function categorize(fdcCategory = "") {
  const c = fdcCategory.toLowerCase();
  if (/veget|fruit/.test(c)) return "Produce";
  if (/dairy|cheese|milk|egg/.test(c)) return "Dairy & Eggs";
  if (/poultry|beef|pork|fish|seafood|meat|lamb/.test(c)) return "Meat & Seafood";
  if (/cereal|grain|bread|pasta|bakery/.test(c)) return "Grains & Bread";
  if (/legume|nut|seed/.test(c)) return "Legumes & Nuts";
  if (/fat|oil/.test(c)) return "Oils & Condiments";
  if (/spice|sauce|sweet|sugar/.test(c)) return "Pantry & Spices";
  return "Other";
}

function pickNutrients(foodNutrients = []) {
  const out = {};
  for (const [col, id] of Object.entries(NUTRIENT)) {
    const n = foodNutrients.find((x) => x.nutrientId === id || x.nutrient?.id === id);
    const v = n?.value ?? n?.amount;
    if (typeof v === "number") out[col] = Math.round(v * 100) / 100;
  }
  return out;
}

async function fetchFood(query) {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${FDC_API_KEY}&query=${encodeURIComponent(
    query,
  )}&dataType=Foundation,SR%20Legacy&pageSize=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FDC ${res.status} for "${query}"`);
  const json = await res.json();
  return json.foods?.[0] ?? null;
}

async function main() {
  const queries = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_QUERIES;
  const rows = [];
  for (const q of queries) {
    try {
      const food = await fetchFood(q);
      if (!food) { console.warn(`· no match: ${q}`); continue; }
      rows.push({
        slug: slugify(q),
        name: q.replace(/\b\w/g, (m) => m.toUpperCase()),
        category: categorize(food.foodCategory),
        source: "usda",
        source_id: String(food.fdcId),
        ...pickNutrients(food.foodNutrients),
      });
      console.log(`✓ ${q} (fdc ${food.fdcId})`);
    } catch (e) {
      console.warn(`✗ ${q}: ${e.message}`);
    }
  }
  if (!rows.length) { console.log("nothing to import"); return; }
  const { error } = await supabase.from("ingredients").upsert(rows, { onConflict: "slug" });
  if (error) { console.error("upsert failed:", error.message); process.exit(1); }
  console.log(`\nImported/updated ${rows.length} ingredients.`);
}

main();
