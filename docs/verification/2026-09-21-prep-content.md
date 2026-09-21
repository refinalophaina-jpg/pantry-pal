# Low-waste prep and food content update

The owner prioritized reducing waste, keeping a small short-term perishable shop,
maintaining a compact cupboard, and preparing about three days of meals twice
weekly. Cuisine priorities are Thai, Nigerian, Indian, Vietnamese and vegetarian
options, with room to explore. This update builds on the live Cloudflare migration;
existing households and data are preserved.

## Behavior

- `/prep/` offers two three-day sessions, each with lunch and dinner. Household
  size scales each calendar meal separately. Three entries therefore represent
  one three-day batch, not three copies of the full batch. Existing occupied
  slots are skipped; the UI reports the number added. Different start dates let
  the user schedule the two sessions and retain a flexible seventh day.
- Shopping aggregates both dishes before subtracting compatible pantry stock
  and outstanding shopping quantities. Fresh, cupboard and freezer categories
  provide practical shopping groups. Storage defaults are suggestions; opened
  sauce labels still govern storage. No expiry dates are invented.
- Six original, vegetarian-friendly kitchen drafts include weighed ingredients,
  instructions, preparation order, finishing suggestions, substitutions and
  nutrition context. They are adaptations inspired by named cuisines, not
  professionally taste-tested recipes or claims of traditional authenticity.
- Calendar meals open an accessible native recipe dialog, with favorite, shopping,
  serving adjustment and cooking actions. The calendar also links to prep,
  shopping and saved recipes. Favorites use the existing saved recipe collection.
- Food guide: 32 exact USDA records, with raw/dry/cooked states, per-100-g data,
  original descriptions, FDC identifiers and source links. Its initial list is
  limited to 12, with search and incremental display.
- Symbolic subject illustrations cover pantry foods, food references and recipes;
  existing provider photographs remain supported, lazy-loaded at bounded size,
  with an illustration fallback on failure. Illustrations are labeled as such.
  Explore renders 24 cards initially and caches at most 24 public query results
  for five minutes, deduplicating simultaneous identical requests. Household data
  is never in that cache. Nutrition lookup concurrency is capped at four.

## Data provenance and accuracy

[USDA FoodData Central API](https://fdc.nal.usda.gov/api-guide/) publishes CC0 food
records. The checked-in snapshot was fetched from official `/foods` endpoints
on 2026-09-21 using a bounded public demonstration-key retrieval, with descriptions
reviewed before mapping. No API key is shipped or needed for this collection at
runtime. The selected records are **SR Legacy historical averages**, not newly
measured Foundation foods or branded-product label values. `food-reference.json`
retains the provider descriptions, IDs, values and retrieval date. Additive D1
migration 0005 inserts the 32 guide references without rewriting household rows.
Migration 0006 adds USDA FDC 173759 (cooked common black-eyed peas, without salt)
so the Nigerian adaptation includes its main protein ingredient. That exact
provider description is preserved in the migration; its 116 kcal, 7.73 g protein
and 6.5 g fiber per 100 g were checked against the official API. The live
reference catalog now has 107 ingredients; the bundled guide displays 32.

The existing USDA importer now preserves the returned exact food description and
uses its FDC ID as the stable slug. It no longer labels the first search result
as the user's broad query (which could turn a cooked-food value into generic
"rice"). Future bulk imports still require reviewing selected food records.

Nutrition lookup preserves preparation state, stops arbitrary last-word matching,
and refuses to convert an unknown volume or piece to a guessed mass. Oil uses an
explicit approximate density; other volume conversions require a database density.
Ambiguous grains, pulses and several protein entries require a more specific name.
Recipe estimates expose coverage and omitted ingredients; partial results are
subtotals, not complete meal totals. Older built-in approximations and curated D1
rows remain best-effort references. Full sodium, micronutrient and allergen coverage
is not claimed. User-provided/saved calorie values are not independently verified.

[USDA leftover guidance](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety)
and [FSA rice guidance](https://www.food.gov.uk/print/pdf/node/4286) underpin the
storage panel. It distinguishes ordinary 3–4-day leftovers from the stricter
24-hour refrigerated-rice guidance and suggests freshly cooked or promptly frozen
rice for later portions. No medical dietary targets are prescribed.

World browsing retains the existing TheMealDB integration and its visible
estimated-time/serving notice. Its developer-key integration is not an unlimited
production data license; expansion to paid provider features is outside this
change. Open Food Facts remains a packaged-food lookup source. Provider data is
not a guarantee of accuracy, and the app does not silently invent missing values.

## Verification

- Typecheck passed; frontend suite 256 tests, Worker suite 57 tests, script suite
  12 tests passed. The final batch-scaling change passed 22 focused tests,
  including its added regression. Production static build passed.
- Chromium: original five journeys passed; the added prep journey passed after
  correcting the fixture's required Origin header. WebKit: all five online
  journeys passed. Final illustration layout check is recorded with deployment.
- The new browser journey exercises real local D1: six meal slots, repeat planning,
  1.2 kg tofu and 480 g dry lentils for two people over three days, 48 g combined
  garlic, no duplicate shopping on repeat, actionable calendar detail, and
  distinct dry/cooked food-guide results. Width checks: 320, 390, 820, 1440 px.
- No physical-device or field Core Web Vitals result is claimed. The new data
  snapshot and recipe source files are each about 12 KB uncompressed; expansion
  avoids a runtime USDA request per card and large automatic provider harvests.

Roll back using a prior D1-compatible Worker version if necessary; migrations
0005 and 0006 are additive reference content and can remain. Never expose the legacy Supabase Pages app as a rollback.

## Deployment and final checks

- Production Worker: `e649241b-63c1-44e0-aafd-d5c26f444ec9`.
- Staging Worker: `986349ca-d19f-4558-b8c0-649862667f45`.
- Final PWA identity: `32e92a6ad20b8600`.
- Both environments received tracked migrations 0005/0006 and passed foreign-key
  checks. Production household, pantry and meal-plan counts were unchanged after
  disposable test fixture cleanup.
- Final build passed 29 live checks in staging and 29 in production through
  `smoke-live-guest.mjs`. The cooked black-eyed pea reference was additionally
  verified directly in production after its additive migration.
- Live `sw.js` and manifest match local bytes exactly. Prep, food-guide and
  meal-plan script references match the tested export; CSP is present.
- WebKit final prep journey passed, including 480 g dry lentils in the six-portion
  cooking view, with 160 g in each two-person calendar recipe. Phone and desktop
  layout captures were inspected; vector illustrations avoid image downloads for
  the new collection. They are conceptual illustrations, not recipe photographs.
- Existing user data was not used as a test fixture. No real recovery code,
  account credential, or household content was added to the repository.
