#!/usr/bin/env node
/** Open Food Facts (ODbL), branded products with per-100 g nutrition, into D1. */
import { fail, fetchJson, isMain, parseTargetArgs, sqlValue, targetHelp, upsertRows, withD1 } from "./d1-tools.mjs";

const UA = "PantryPal/1.0 (catalog importer; +https://pantry.ainadara.com)";
const headers = { "User-Agent": UA, Accept: "application/json" };
const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));
const num = value => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;

export function toRow(product) {
  const code = String(product?.code ?? "");
  const name = product?.product_name_en || product?.product_name;
  if (!/^\d{4,32}$/.test(code) || typeof name !== "string" || !name.trim()) return null;
  const nutrients = product.nutriments ?? {};
  return {
    barcode: code,
    name: name.trim(),
    brand: typeof product.brands === "string" ? product.brands.split(",")[0]?.trim() || null : null,
    category: typeof product.categories === "string" ? product.categories.split(",").pop()?.trim() || "Other" : "Other",
    serving_size: typeof product.serving_size === "string" ? product.serving_size || null : null,
    calories: num(nutrients["energy-kcal_100g"]),
    protein_g: num(nutrients.proteins_100g),
    carbs_g: num(nutrients.carbohydrates_100g),
    fat_g: num(nutrients.fat_100g),
    fiber_g: num(nutrients.fiber_100g),
    source: "openfoodfacts",
    source_id: code,
  };
}

export async function byBarcode(code, fetchImpl = fetch) {
  if (!/^\d{4,32}$/.test(code)) throw new Error(`Invalid barcode: ${code}.`);
  const payload = await fetchJson(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, { headers }, fetchImpl);
  if (payload.status === 0) return null;
  if (payload.status !== 1 || !payload.product) throw new Error("Open Food Facts returned an invalid product response.");
  return toRow(payload.product);
}

function productRows(payload) {
  if (!Array.isArray(payload.products)) throw new Error("Open Food Facts returned an invalid search response.");
  const rows = payload.products.map(toRow).filter(Boolean);
  const skipped = payload.products.length - rows.length;
  if (skipped) console.warn(`${skipped} products skipped: missing valid barcode or name.`);
  return rows;
}

async function bySearch(term, pages) {
  const rows = [];
  for (let page = 1; page <= pages; page++) {
    if (page > 1) await sleep(6500); // OFF search rate: at most 10 requests/minute.
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    for (const [key, value] of Object.entries({ search_terms: term, json: 1, page_size: 50, page })) url.searchParams.set(key, String(value));
    const payload = await fetchJson(url, { headers });
    rows.push(...productRows(payload));
    if (!payload.products.length) break;
  }
  return rows;
}

async function refreshCatalog(d1) {
  const all = [];
  let cursor = "";
  for (;;) {
    const results = await d1.query(`SELECT barcode FROM foods WHERE source='openfoodfacts' AND barcode IS NOT NULL AND barcode>${sqlValue(cursor)} ORDER BY barcode LIMIT 1000;`);
    const page = results.flatMap(result => result.results ?? []);
    for (const row of page) {
      if (!/^\d{4,32}$/.test(row.barcode)) throw new Error("Existing catalog contains an invalid barcode; repair it before refreshing.");
      all.push(row.barcode);
    }
    if (page.length < 1000) break;
    cursor = page.at(-1).barcode;
  }
  console.log(`Refreshing ${all.length} cataloged products.`);
  const rows = [];
  for (let start = 0; start < all.length; start += 100) {
    if (start) await sleep(6500);
    const codes = all.slice(start, start + 100);
    const url = new URL("https://world.openfoodfacts.org/api/v2/search");
    url.searchParams.set("code", codes.join(","));
    url.searchParams.set("fields", "code,product_name,product_name_en,brands,categories,serving_size,nutriments");
    url.searchParams.set("page_size", "100");
    const batch = productRows(await fetchJson(url, { headers })).filter(row => codes.includes(row.barcode));
    const found = new Set(batch.map(row => row.barcode));
    const missing = codes.filter(code => !found.has(code));
    if (missing.length) console.warn(`Products absent from upstream response (existing rows retained): ${missing.join(", ")}`);
    rows.push(...batch);
  }
  return rows;
}

export function importMode(args) {
  if (args[0] === "--refresh" && args.length === 1) return { type: "refresh" };
  if (args[0] === "--search") {
    const term = args[1]?.trim();
    const pages = args.length === 4 && args[2] === "--pages" ? Number(args[3]) : args.length === 2 ? 1 : NaN;
    if (!term || term.startsWith("--") || term.length > 250 || !Number.isInteger(pages) || pages < 1 || pages > 100) throw new Error("Use --search <term> [--pages 1..100].");
    return { type: "search", term, pages };
  }
  if (!args.length || args.some(arg => !/^\d{4,32}$/.test(arg))) throw new Error("Provide barcodes, --search <term> [--pages N], or --refresh.");
  return { type: "barcodes", codes: [...new Set(args)] };
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help")) { console.log(`Import Open Food Facts into D1.\n[barcodes...] | --search <term> [--pages 1..100] | --refresh\n${targetHelp}`); return; }
  const { target, args } = parseTargetArgs(argv);
  const mode = importMode(args);
  await withD1(target, async d1 => {
    let rows;
    if (mode.type === "refresh") rows = await refreshCatalog(d1);
    else if (mode.type === "search") rows = await bySearch(mode.term, mode.pages);
    else {
      rows = [];
      for (const code of mode.codes) {
        const row = await byBarcode(code);
        if (row) rows.push(row);
        else console.warn(`${code}: no usable product found.`);
      }
    }
    rows = [...new Map(rows.map(row => [row.barcode, row])).values()];
    await upsertRows(d1, "foods", rows);
    console.log(`Imported/updated ${rows.length} products.`);
  });
}
if (isMain(import.meta.url)) main().catch(fail);
