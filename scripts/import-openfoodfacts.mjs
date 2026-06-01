#!/usr/bin/env node
/**
 * Import branded products from Open Food Facts into public.foods.
 *
 * Open Food Facts data is open (ODbL). Nutriments are per 100 g.
 *
 * Env:
 *   SUPABASE_URL                 your project URL
 *   SUPABASE_SERVICE_ROLE_KEY    service role key (server only!)
 *
 * Usage:
 *   node scripts/import-openfoodfacts.mjs 737628064502 3017620422003   # by barcode
 *   node scripts/import-openfoodfacts.mjs --search "oat milk" --pages 2 # by search
 *
 * Idempotent: upserts on the `barcode` unique key.
 */
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const UA = "PantryPal/0.4 (data importer; +https://pantry-pal.pages.dev)";

function num(v) {
  return typeof v === "number" ? Math.round(v * 100) / 100 : undefined;
}

function toRow(p) {
  if (!p?.code || !(p.product_name || p.product_name_en)) return null;
  const n = p.nutriments ?? {};
  return {
    barcode: String(p.code),
    name: p.product_name_en || p.product_name,
    brand: (p.brands || "").split(",")[0]?.trim() || null,
    category: (p.categories || "").split(",").pop()?.trim() || "Other",
    serving_size: p.serving_size || null,
    calories: num(n["energy-kcal_100g"]),
    protein_g: num(n.proteins_100g),
    carbs_g: num(n.carbohydrates_100g),
    fat_g: num(n.fat_100g),
    fiber_g: num(n.fiber_100g),
    source: "openfoodfacts",
    source_id: String(p.code),
  };
}

async function byBarcode(code) {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${code}.json`,
    { headers: { "User-Agent": UA } },
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.status === 1 ? toRow(json.product) : null;
}

async function bySearch(term, pages) {
  const rows = [];
  for (let page = 1; page <= pages; page++) {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      term,
    )}&json=1&page_size=50&page=${page}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) break;
    const json = await res.json();
    for (const p of json.products ?? []) {
      const r = toRow(p);
      if (r) rows.push(r);
    }
  }
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  let rows = [];
  const searchIdx = args.indexOf("--search");
  if (searchIdx !== -1) {
    const term = args[searchIdx + 1];
    const pagesIdx = args.indexOf("--pages");
    const pages = pagesIdx !== -1 ? Number(args[pagesIdx + 1]) : 1;
    rows = await bySearch(term, pages);
  } else {
    for (const code of args) {
      const r = await byBarcode(code);
      if (r) rows.push(r);
      console.log(r ? `✓ ${code} ${r.name}` : `✗ ${code} not found`);
    }
  }
  // De-dupe by barcode (search can repeat across pages).
  const seen = new Set();
  rows = rows.filter((r) => (seen.has(r.barcode) ? false : seen.add(r.barcode)));
  if (!rows.length) { console.log("nothing to import"); return; }
  const { error } = await supabase.from("foods").upsert(rows, { onConflict: "barcode" });
  if (error) { console.error("upsert failed:", error.message); process.exit(1); }
  console.log(`\nImported/updated ${rows.length} products.`);
}

main();
