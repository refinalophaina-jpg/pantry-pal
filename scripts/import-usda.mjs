#!/usr/bin/env node
/** USDA FoodData Central public-domain, per-100 g nutrition, into D1. */
import { fail, fetchJson, isMain, parseTargetArgs, targetHelp, upsertRows, withD1 } from "./d1-tools.mjs";

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
export function slugify(value) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
export function categorize(category = "") {
  const c = (typeof category === "string" ? category : category?.description ?? "").toLowerCase();
  if (/veget|fruit/.test(c)) return "Produce";
  if (/dairy|cheese|milk|egg/.test(c)) return "Dairy & Eggs";
  if (/poultry|beef|pork|fish|seafood|meat|lamb/.test(c)) return "Meat & Seafood";
  if (/cereal|grain|bread|pasta|bakery/.test(c)) return "Grains & Bread";
  if (/legume|nut|seed/.test(c)) return "Legumes & Nuts";
  if (/fat|oil/.test(c)) return "Oils & Condiments";
  if (/spice|sauce|sweet|sugar/.test(c)) return "Pantry & Spices";
  return "Other";
}
export function pickNutrients(foodNutrients = []) {
  if (!Array.isArray(foodNutrients)) throw new Error("FDC returned invalid nutrient data.");
  const output = {};
  for (const [column, id] of Object.entries(NUTRIENT)) {
    const nutrient = foodNutrients.find(value => value.nutrientId === id || value.nutrient?.id === id);
    const amount = nutrient?.value ?? nutrient?.amount;
    output[column] = typeof amount === "number" && Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
  }
  return output;
}
export async function fetchFood(query, key, fetchImpl = fetch) {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  // The upstream API requires this key; fetchJson never logs URLs or error causes.
  for (const [name, value] of Object.entries({ api_key: key, query, dataType: "Foundation,SR Legacy", pageSize: "1" })) url.searchParams.set(name, value);
  const payload = await fetchJson(url, {}, fetchImpl);
  if (!Array.isArray(payload.foods)) throw new Error("FDC returned an invalid search response.");
  return payload.foods[0] ?? null;
}
export function toRow(query, food) {
  if (!food.fdcId || !food.description?.trim()) throw new Error("FDC result needs its food ID and exact description.");
  return { slug: `fdc-${food.fdcId}`, name: food.description.trim(), category: categorize(food.foodCategory), source: "usda", source_id: String(food.fdcId), ...pickNutrients(food.foodNutrients) };
}
export async function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help")) { console.log(`Import USDA FoodData Central into D1. Requires FDC_API_KEY.\n[food queries...] (default: common foods)\n${targetHelp}`); return; }
  const { target, args } = parseTargetArgs(argv);
  const queries = args.length ? args.map(query => query.trim()) : DEFAULT_QUERIES;
  if (queries.some(query => query.startsWith("--") || query.length > 250 || !slugify(query))) throw new Error("Provide nonempty food queries of at most 250 characters.");
  if (!process.env.FDC_API_KEY) throw new Error("Missing FDC_API_KEY.");
  await withD1(target, async d1 => {
    const rows = [];
    for (const query of queries) {
      const food = await fetchFood(query, process.env.FDC_API_KEY);
      if (!food) { console.warn(`No FDC match: ${query}.`); continue; }
      rows.push(toRow(query, food));
      console.log(`Found ${query} (FDC ${food.fdcId}).`);
    }
    await upsertRows(d1, "ingredients", [...new Map(rows.map(row => [row.slug, row])).values()]);
    console.log(`Imported/updated ${new Set(rows.map(row => row.slug)).size} ingredients.`);
  });
}
if (isMain(import.meta.url)) main().catch(fail);
