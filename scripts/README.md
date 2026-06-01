# Data importers

Scripts that populate the **food consortium** reference tables
(`ingredients`, `foods`) added in
`supabase/migrations/20260601000001_food_consortium.sql`.

They write with the **service role key**, which bypasses RLS — run them from a
trusted machine/CI only, never ship the key to the client.

```bash
export SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"   # Project Settings → API
```

## USDA FoodData Central → `ingredients`

Public-domain, per-100 g nutrition. Get a free key at
<https://fdc.nal.usda.gov/api-key-signup.html>.

```bash
export FDC_API_KEY="<key>"
node scripts/import-usda.mjs                      # curated common-foods list
node scripts/import-usda.mjs rice "olive oil"     # specific items
```

Upserts on `slug`, so it's safe to re-run and extend.

## Open Food Facts → `foods`

Open data (ODbL), branded products by barcode. No key needed.

```bash
node scripts/import-openfoodfacts.mjs 737628064502 3017620422003   # by barcode
node scripts/import-openfoodfacts.mjs --search "oat milk" --pages 2 # by search
```

Upserts on `barcode`. Feeds the barcode-scanner lookup
(`lookupFoodByBarcode` in `src/lib/food-db.ts`) so scans resolve from our own
catalog before falling back to a live API.

## Notes

- Both scripts are idempotent and rate-limit-friendly (small page sizes).
- The migration ships a curated seed (~32 ingredients, 5 techniques) so the
  tables are useful before any import runs.
- Search is exposed via the `search_ingredients` / `search_recipe_catalog`
  RPCs (prefix + full-text + trigram), consumed by `src/lib/food-db.ts`.
