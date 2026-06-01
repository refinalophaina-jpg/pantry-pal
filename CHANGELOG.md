# Changelog

All notable changes to Pantry Pal are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Changes land here before the next tagged release._

### Added
- **Food consortium (data layer):** new public-read reference tables —
  `ingredients` (canonical, alias-matched, per-100 g nutrition), `foods`
  (branded/barcode products), `techniques` (cooking guides), and
  `recipe_catalog` (shared recipe corpus) — each with full-text **and** trigram
  search, so lookups tolerate typos and word order. A `search_ingredients` /
  `search_recipe_catalog` RPC powers autocomplete; `src/lib/food-db.ts` is the
  typed client. Ships a curated seed (~32 ingredients, 5 techniques); importers
  in `scripts/` load USDA FoodData Central → ingredients and Open Food Facts →
  foods. Migration validated against a throwaway Postgres 16 + pg_trgm.
- **Native packaging (Capacitor):** the static export now wraps into native iOS
  and Android shells via Capacitor 8 (`capacitor.config.ts`, `cap:sync` /
  `cap:ios` / `cap:android` scripts). `PACKAGING.md` documents the build path for
  web/PWA, iOS, Android, and (planned) Tauri desktop. Native projects are
  generated, not tracked.
- **AinaDara design system:** the app is reskinned in warm "paper" tones —
  terracotta / purple / moss accents, DM Serif Display titles, Outfit body, a
  fixed paper-grain overlay and ambient washes. Implemented by repointing the
  existing semantic CSS variables onto brand tokens, so every page inherits the
  look. The basket logo and the photo-less recipe header were recoloured to match.
- **Dark mode + theme toggle:** warm, low-glare dark theme driven by
  `data-theme`, set before paint to avoid flashes; a sidebar toggle switches and
  remembers the choice (`pantry-pal-theme`). Honours `prefers-color-scheme` with
  no JS.
- **Test infrastructure:** Vitest 3 + Testing Library + jsdom, with `test`,
  `test:watch`, `test:cov`, and `typecheck` scripts. First unit suites cover the
  date/format helpers (`lib/utils`) and nutrition lookup + recipe estimation
  (`lib/nutrition`).
- **Continuous integration:** GitHub Actions workflow runs type-check, tests
  (with coverage), and the production build on every push and PR.
- **`ROADMAP.md`** — the phased plan toward a cross-platform, data-rich app in
  the AinaDara design language.

### Fixed
- Nutrition lookup now resolves `-es`/`-oes`/`-ies` plurals, so ingredients like
  **tomatoes** and **potatoes** match their per-100 g data (previously only a
  bare trailing `-s` was stripped, yielding `tomatoe` → no match).

## [0.3.0] — 2026-05-29

The "make it a real cooking hub" release: a much bigger recipe database, AI photo
recognition and meal planning, a shopping list driven by your plan + pantry, and
your own stores with aisle layouts. Also fixes the stale-build issue that made
the app feel broken.

### Added
- **Photo → ingredients (AI):** snap/upload a photo of groceries or a fridge and
  Claude Haiku lists the items, which you confirm (editable name + category,
  uncheck any) before adding. Photos are stored in a private, household-scoped
  **Supabase Storage** bucket (`pantry-photos`). Recognition runs in a Supabase
  Edge Function (`recognize-pantry`) so the API key stays server-side.
  Requires the `ANTHROPIC_API_KEY` secret set on the Supabase project.
- **Spoonacular recipe engine:** Explore now searches thousands of recipes across
  every cuisine (deep coverage for Indian/French/Vietnamese/Thai/Chinese/Korean/
  African…), each opening a full recipe (ingredients, steps) you can save/cook/
  add-to-list. Proxied via the `recipe-search` Edge Function. Requires the
  `SPOONACULAR_API_KEY` secret. (Replaces TheMealDB's free key, which returned 0
  results for Indian/French.)
- **Smart shopping list:** "Build week's list" derives what to buy from this
  week's meal plan minus what's in the pantry (consolidated, de-duped); "Got it →
  move to pantry" closes the loop.
- **AI weekly meal-plan generator:** Claude assigns your recipes across a 1–2 week
  span by preferences (`generate-meal-plan` Edge Function), capped at 10/day per
  household via an `ai_usage` table.
- **Stores & aisle-ordered shopping:** add your stores (Walmart, H-E-B, Whole
  Foods, Central Market…); pick one to sort the shopping list by aisle, record
  each item's aisle/shelf/price (remembered per store via `stores` +
  `item_locations` tables), and open a "find near 77056" maps link.

### Fixed
- **Service worker no longer serves stale builds** — switched to network-first
  for HTML/navigations (cache-first only for hashed assets), so deploys take
  effect immediately. This was the main cause of "nothing works."

## [0.2.0] — 2026-05-29

A reliability, content, and polish release: the app now ships real recipes, a
working barcode scanner, a cohesive illustrated look, and installs on iOS.

### Added
- **Chef Pham's recipe collection** — replaced the placeholder samples with 20
  real recipes across Thai, Vietnamese, Chinese, Korean, Nigerian, Indian and
  American cooking (plus sauces and desserts), tagged by cuisine and
  vegan/vegetarian, with quantities, steps, and nutrition estimates.
- **Real barcode product lookup** via Open Food Facts (free, key-less), with an
  editable confirm step and manual-entry fallback. ZXing still does decoding.
- **Warm illustrated visual system** — custom logo/app mark, dashboard hero
  banner, and empty-state illustrations for pantry, shopping, meal plan and
  recipes (hand-authored SVG).
- **Installable iOS PWA** — web manifest, app icons, theme colour, apple-web-app
  metadata, and an offline-shell service worker.
- **Interactive deals** — dashboard and shopping deal rows link out to a live
  price comparison for the item + store.
- Recipe detail: ingredient-availability bar, calories-first per-serving grid,
  a gradient header for photo-less recipes, and Escape-to-close + scroll lock.
- Detailed `README.md` and this `CHANGELOG.md`.

### Changed
- All store writes now route through a `useAction` helper: success toasts fire
  only after the write lands, and failures surface as warnings.
- Onboarding's household creation has a timeout + error handling so it can't
  hang silently.

### Fixed
- **Household creation was impossible** — the `households` `SELECT` policy
  depended on a membership row created by an `AFTER INSERT` trigger, so the
  `insert().select()` read-back failed RLS. The creator can now read their own
  household. Also restored `EXECUTE` on `is_household_member` to `authenticated`
  (a prior hardening migration had revoked it, breaking every table's RLS).
- **Hydration mismatches** from `new Date()` during render on the dashboard,
  meal plan and analytics (stale at static-export build time) — now deferred
  behind a mounted flag.
- Camera scanner wouldn't start: switched from device-label matching to
  `decodeFromConstraints({ facingMode: "environment" })` with friendly
  permission/secure-context errors.
- `randomMeals` no longer fails entirely when one request fails; explore search
  surfaces errors; nutrition lookups run in parallel and are crash-guarded.

## [0.1.0] — 2026-05-28

Initial release.

### Added
- Supabase **auth**, households, invite flow, Row-Level Security, and live
  **realtime sync** of pantry, shopping list, meal plan, usage and saved recipes.
- Core pages: dashboard, pantry (with barcode/photo entry), recipes with cook
  mode, weekly meal plan, deal-aware shopping list, and analytics.
- **Explore** tab powered by TheMealDB; built-in + cached nutrition estimates.
- Static export build and Cloudflare Pages deployment.

[Unreleased]: https://github.com/refinalophaina-jpg/pantry-pal/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/refinalophaina-jpg/pantry-pal/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/refinalophaina-jpg/pantry-pal/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/refinalophaina-jpg/pantry-pal/releases/tag/v0.1.0
