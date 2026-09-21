import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { parseTargetArgs, parseWranglerJson, selectDatabase, sqlValue, upsertRows, upsertSql } from "./d1-tools.mjs";
import { byBarcode, importMode, toRow as offRow } from "./import-openfoodfacts.mjs";
import { fetchFood, pickNutrients, toRow as usdaRow } from "./import-usda.mjs";

test("defaults to local, requires explicit remote environment, and never falls back from missing production", () => {
  assert.equal(parseTargetArgs([]).target.remote, false);
  assert.equal(parseTargetArgs(["--env", "staging"]).target.remote, false);
  assert.throws(() => parseTargetArgs(["--remote"]), /requires --env/);
  assert.throws(() => parseTargetArgs(["--remote", "--local"]), /either/);
  assert.throws(() => parseTargetArgs(["--env"]), /Missing/);
  assert.throws(() => selectDatabase({ d1_databases: [{ binding: "DB", database_name: "staging", database_id: "id" }] }, "production"), /not configured/);
  assert.deepEqual(parseTargetArgs(["--env", "staging", "--remote", "rice"]).args, ["rice"]);
});

test("extracts remote Wrangler JSON after SQL upload progress and still rejects failures", () => {
  const results = [{ results: [], success: true }];
  const output = `├ Checking if file needs uploading\n├ Uploading complete\n${JSON.stringify(results, null, 2)}\n`;
  assert.deepEqual(parseWranglerJson(output), results);
  assert.deepEqual(parseWranglerJson(JSON.stringify(results)), results);
  assert.throws(() => parseWranglerJson('Progress\n[\n{"success":false}\n]\n'), /unsuccessful/);
  assert.throws(() => parseWranglerJson("Upload failed"), /valid D1 JSON/);
});

test("preserves textual barcodes, decimal nutrition, unknowns and USDA mappings", () => {
  const row = offRow({ code: "0012345678905", product_name: "Bean's", nutriments: { "energy-kcal_100g": 123.456, proteins_100g: 0 } });
  assert.equal(row.barcode, "0012345678905");
  assert.equal(row.calories, 123.46);
  assert.equal(row.protein_g, 0);
  assert.equal(row.fat_g, null);
  assert.equal(offRow({ code: "1234" }), null);
  assert.equal(pickNutrients([{ nutrient: { id: 1008 }, amount: 12.345 }]).calories, 12.35);
  const food = usdaRow("olive oil", { fdcId: 123, foodCategory: "Fats and Oils", foodNutrients: [] });
  assert.equal(food.slug, "olive-oil");
  assert.equal(food.category, "Oils & Condiments");
  assert.equal(food.calories, null);
});

test("uses SQLite-safe literals, idempotent upserts, and retains curated aliases", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE ingredients(id TEXT PRIMARY KEY,slug TEXT UNIQUE,name TEXT,category TEXT,calories REAL,protein_g REAL,carbs_g REAL,fat_g REAL,fiber_g REAL,source TEXT,source_id TEXT,aliases TEXT DEFAULT '[]',updated_at TEXT);");
    const row = usdaRow("cook's rice", { fdcId: 123, foodNutrients: [] });
    db.exec(upsertSql("ingredients", row));
    db.exec("UPDATE ingredients SET aliases='[\"rice\"]';");
    const original = db.prepare("SELECT id FROM ingredients").get().id;
    db.exec(upsertSql("ingredients", { ...row, calories: 125.7 }));
    const saved = db.prepare("SELECT * FROM ingredients").get();
    assert.equal(saved.id, original);
    assert.equal(saved.name, "Cook'S Rice");
    assert.equal(saved.calories, 125.7);
    assert.equal(saved.aliases, '["rice"]');
    assert.equal(db.prepare("SELECT count(*) AS n FROM ingredients").get().n, 1);
    assert.equal(sqlValue("x'); DROP TABLE ingredients; --"), "'x''); DROP TABLE ingredients; --'");
    assert.throws(() => upsertSql("__proto__", row), /Unknown catalog table/);
    assert.throws(() => upsertSql("ingredients", { ...row, unauthorized: 1 }), /Unknown catalog field/);
  } finally { db.close(); }
});

test("stops after a failed D1 batch and validates all rows before the first write", async () => {
  let writes = 0;
  const d1 = { execute: async () => { writes++; throw new Error("D1 batch failed"); } };
  const row = offRow({ code: "1234", product_name: "Rice" });
  await assert.rejects(upsertRows(d1, "foods", Array.from({ length: 60 }, () => row)), /D1 batch failed/);
  assert.equal(writes, 1);
  writes = 0;
  await assert.rejects(upsertRows(d1, "foods", [row, { ...row, invalid: true }]), /Unknown catalog field/);
  assert.equal(writes, 0);
});

test("HTTP and malformed provider responses fail, without exposing USDA API keys", async () => {
  await assert.rejects(byBarcode("1234", async () => new Response("", { status: 503 })), /HTTP 503/);
  await assert.rejects(byBarcode("1234", async () => Response.json({})), /invalid product/);
  await assert.rejects(fetchFood("rice", "secret-api-key", async () => { throw new Error("URL includes secret-api-key"); }), error => error.message.includes("Provider request failed") && !error.message.includes("secret-api-key"));
  await assert.rejects(fetchFood("rice", "secret", async () => Response.json({})), /invalid search/);
  assert.equal(await byBarcode("1234", async () => Response.json({ status: 0 })), null);
  assert.throws(() => importMode(["--search", "milk", "--pages", "NaN"]), /Use --search/);
});
