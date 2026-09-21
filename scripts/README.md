# D1 migrations and catalog imports

These Node scripts use the repository's installed Wrangler CLI and the `DB`
binding in `wrangler.jsonc`. They write Cloudflare D1; no Supabase credentials or
browser-facing administrative endpoint is used. Run `npm ci` first.

## Select a database

Every script accepts the same target flags:

- `--env local|staging|production`: select the top-level binding or the named
  environment. The default is `local`.
- `--local` or `--remote`: the default is always **local**, even when selecting
  the staging configuration. Remote writes require an explicit `--env staging`
  or `--env production` and a configured database name and ID.
- `--persist-to <directory>`: optional local persistence directory. The default
  is the project's `.wrangler/state`, shared with `wrangler dev`.
- `--config <path>`: optional Wrangler JSON/JSONC configuration file.
- `--help`: print usage without fetching or writing anything.

Remote runs use Wrangler authentication: an existing local Wrangler login or
`CLOUDFLARE_API_TOKEN` and the configured Cloudflare account. Supply credentials
through the environment or the platform's secret settings. The CLI prints the
environment, local/remote scope, and database name before performing work.
Missing environments fail instead of falling back to another database.

## Apply tracked migrations

```bash
node scripts/migrate-d1.mjs
node scripts/migrate-d1.mjs --env staging --remote
node scripts/migrate-d1.mjs --env production --remote
```

The runner calls `wrangler d1 migrations apply` for `migrations/auth` first,
using the `d1_auth_migrations` tracking table. It then applies `migrations/d1`,
using `d1_migrations` (or the DB binding's configured `migrations_table`). Both
groups use the same database. Temporary minimal Wrangler configurations select
the two directories without changing the project configuration.

Wrangler records successful migrations and skips them on rerun. A failure stops
the runner before the next group; already successful migrations stay applied.
Afterward, `PRAGMA foreign_key_check` must return no violations. Do not apply the
same schema manually with `d1 execute` first: untracked existing tables need
inspection and reconciliation, not automatic migration-history fabrication.
See [Cloudflare's migration documentation](https://developers.cloudflare.com/d1/reference/migrations/).

The public reference seed contains 74 ingredients, 15 technique guides, and six
recipes. It does not import users or household data from another service.

## USDA FoodData Central → `ingredients`

The importer retains the existing Foundation/SR Legacy food search and nutrient
mapping. Nutrition is per 100 g; missing or invalid amounts remain `NULL`.
USDA data is public domain. Obtain `FDC_API_KEY` through
[FoodData Central](https://fdc.nal.usda.gov/api-key-signup.html), then provide it
as an environment variable.

```bash
node scripts/import-usda.mjs                        # local, common-foods list
node scripts/import-usda.mjs rice "olive oil"       # local, specific foods
node scripts/import-usda.mjs --env staging --remote rice "olive oil"
```

Upserts use the ingredient `slug`; existing row IDs and curated aliases remain
intact. An upstream match can update the name, category, provenance, and nutrient
columns. Review broad USDA search matches before using them as canonical foods.

## Open Food Facts → `foods`

Open Food Facts data is [ODbL](https://world.openfoodfacts.org/data), with
nutrition per 100 g. Barcodes remain text, including leading zeroes.

```bash
node scripts/import-openfoodfacts.mjs 737628064502 3017620422003
node scripts/import-openfoodfacts.mjs --search "oat milk" --pages 2
node scripts/import-openfoodfacts.mjs --env staging --remote --refresh
```

Upserts use the unique `barcode`; existing IDs and ingredient associations stay
intact. `--refresh` reads the selected D1 catalog and requests products in
batches of 100. Search and refresh requests are spaced 6.5 seconds apart.
Products absent from a successful upstream response are reported and retained
in D1. The deployed monthly schedule uses the Worker catalog job; this CLI is
also available for explicit administrative imports and refreshes.

## Failure behavior and checks

HTTP errors, malformed provider responses, and failed D1 writes stop with a
nonzero exit code. All upstream fetching completes before import writes begin;
all rows are validated before the first SQL batch. Writes use batches of at
most 50 upserts. If a later batch fails, earlier successful batches may already
be committed; rerunning is safe because the unique keys make upserts repeatable.
Valid upstream no-match results are reported separately from request failures.
Unknown nutrition is never silently replaced with zero.

Catalog reads are served by `/api/catalog/*`, using D1 full-text search and
ingredient aliases. Importers do not write household tables.

```bash
node --test scripts/d1-tools.test.mjs
```

These checks use provider fixtures and local SQLite, covering target selection,
SQL escaping and repeatability, nutrient mapping, failed batches, redacted
provider errors, and Wrangler JSON output with upload-progress prefixes. They
do not contact providers or a remote database.
