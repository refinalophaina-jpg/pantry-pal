# Changelog

All notable changes to Pantry Pal are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/refinalophaina-jpg/pantry-pal/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/refinalophaina-jpg/pantry-pal/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/refinalophaina-jpg/pantry-pal/releases/tag/v0.1.0
