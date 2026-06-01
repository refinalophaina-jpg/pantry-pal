# Pantry Pal — Platform Roadmap

> The plan to take Pantry Pal from a working v0.3.0 PWA to a fully-packaged,
> cross-platform food app with a deep data layer, an AinaDara-grade interactive
> UI, and exhaustive test coverage — refined continuously under version control.
>
> This is a living document. Each phase lists its layers (backend / middle /
> frontend), concrete deliverables, and an exit gate that must be green before
> the phase is "done". Nothing ships unless `npm run typecheck`, `npm test`, and
> `npm run build` all pass.

## North star

A household kitchen app that is genuinely delightful to use on **web, iOS,
Android, and desktop**, backed by a **large, queryable corpus** of foods,
ingredients, recipes, and cooking guides, presented through the **AinaDara
visual language** (warm paper, terracotta/purple/moss, DM Serif + Outfit, paper
grain, deliberate motion), and protected by a **comprehensive test suite**.

## Stack, by layer

| Layer | Today | Target |
|---|---|---|
| **Frontend** | Next.js 16 App Router, static export; React 19; Tailwind v4; Zustand; lucide | + AinaDara design system, motion layer, dynamic/interactive components, a11y |
| **Client data** | Zustand store, realtime sync | + offline-first cache, optimistic writes, search index |
| **Edge / middle** | Supabase Edge Functions (recipe-search, recognize-pantry, generate-meal-plan) | + ingredient/food search, nutrition enrichment, data-import jobs |
| **Backend** | Supabase Postgres + Auth + RLS + Realtime + Storage | + canonical food/ingredient/recipe/technique schema, full-text & trigram search |
| **Data corpus** | ~20 built-in recipes, small nutrition table, Spoonacular/MealDB/OpenFoodFacts live | + USDA FoodData Central, Open Food Facts bulk, canonical ingredient taxonomy, cooking-technique guides |
| **Packaging** | PWA (manifest + service worker) | + Capacitor (iOS/Android), Tauri or Electron (desktop), signed builds |
| **Quality** | tsc strict | + Vitest unit/integration, Playwright E2E, a11y, visual regression, CI |

---

## Phase 0 — Foundations ✅ (in progress)

**Goal:** a green, testable baseline and a written plan.

- [x] Vitest 3 + Testing Library + jsdom wired (`vitest.config.ts`, `src/test/setup.ts`).
- [x] First unit tests: `utils` (dates, formatters), `nutrition` (lookup, estimation).
- [x] Fix found by tests: plural normalization (`tomatoes`/`potatoes`/`berries`).
- [x] Scripts: `typecheck`, `test`, `test:watch`, `test:cov`.
- [x] This ROADMAP + design-system capture in memory.
- [x] GitHub Actions CI (typecheck + test + build on push/PR).
- [x] Coverage baseline recorded (54.5% overall; pure logic 90–100%).

**Exit gate:** `typecheck` + `test` + `build` green; CI runs on push.

## Phase 1 — AinaDara design system

**Frontend.** Replace the generic green theme with AinaDara tokens; add fonts,
paper grain, ambient washes, wave ornaments, dark mode with persistence + FOUC
guard; rebuild `ui.tsx` primitives (Button, Card, Badge, Input) on the tokens;
a motion layer (reduced-motion aware). Snapshot/visual tests per primitive.

**Exit gate:** every page renders on the new tokens; light/dark both pass
contrast; primitives have tests.

## Phase 2 — Data consortium (backend + middle)

**Backend.** New schema: `ingredients` (canonical, with aliases, category,
density, per-100g nutrition), `foods` (branded/OFF products), `recipes` (richer
than today), `techniques`/`cooking_guides`. Full-text + `pg_trgm` search. RLS
for public-read reference tables vs household-scoped user data.

**Middle.** Import pipelines: USDA FoodData Central (foundation + SR legacy),
Open Food Facts subset, a curated technique/guide set. Edge functions for
ingredient search + nutrition enrichment that prefer the canonical tables before
external APIs. Idempotent, resumable importers with provenance.

**Exit gate:** ingredient search returns canonical results offline; nutrition
estimation uses the DB; importers documented + re-runnable; schema migrations
tested.

## Phase 3 — Dynamic, interactive UI

Elevate each surface: dashboard, pantry, recipes, explore, meal-plan, shopping,
analytics. Interactions: drag-and-drop meal planning, animated transitions,
command palette, ingredient autocomplete against the corpus, rich recipe view,
skeleton/loading states, empty states in the AinaDara illustration style.

**Exit gate:** key flows have interaction tests; no layout shift; keyboard +
screen-reader navigable.

## Phase 4 — Cross-platform packaging

**Web/PWA:** harden offline, installability, update flow.
**iOS/Android:** Capacitor wrapping the static export; native shell, splash,
icons, status bar, safe areas, camera/barcode permissions; `.ipa`/`.apk` builds.
**Desktop:** Tauri (preferred, small) or Electron; window chrome, auto-update.

**Exit gate:** documented build commands per target; app launches and a smoke
flow works on each platform reachable in this environment.

## Phase 5 — Exhaustive testing & continuous refinement

Push unit coverage across `lib`; integration tests for the store + sync;
Playwright E2E for the core journeys; accessibility (axe) and performance
budgets; visual regression. Then loop: profile, fix, expand data/features, keep
`CHANGELOG.md` + SemVer, commit in small reviewable increments.

**Exit gate (ongoing):** coverage trends up; CI stays green; each release tagged
and changelogged.

---

## Working agreement

- Branch: `feat/platform-foundation` (and topic branches off it as needed).
- Every change keeps `typecheck` + `test` + `build` green before commit.
- Small, reviewable commits with conventional-commit messages.
- Update this ROADMAP and `CHANGELOG.md` as phases progress.
