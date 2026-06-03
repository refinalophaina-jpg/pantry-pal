<div align="center">
  <img src="public/illustrations/logo.svg" width="72" alt="Pantry Pal" />
  <h1>Pantry Pal</h1>
  <p><strong>Cook more · waste less.</strong></p>
  <p>A shared household kitchen app — smart pantry inventory, recipes from what you already have, live recipe scaling, meal planning, a deal-aware shopping list, cooking guides, and waste analytics.</p>
  <p>🌐 <a href="https://pantry-pal.pages.dev">pantry-pal.pages.dev</a> · one codebase → <strong>web · iOS · Android · desktop</strong></p>
</div>

---

## What it does

Pantry Pal is built for a household (you + partner/roommates) sharing one kitchen.
Everyone in a household sees the same pantry, shopping list, and meal plan **in
real time**.

| Area | What you get |
|------|--------------|
| **Dashboard** | Today's planned calories, expiring-soon alerts, "cook with what you have", local deals, quick actions. |
| **Pantry** | Add by hand, **scan a barcode**, or **snap a photo** (AI lists the items). Track quantity, unit, storage zone, and expiry. **Inline +/- quantity steppers**, **drag items between zones**, and **sort** by expiry / name / recency. Use & waste tracking feeds analytics. |
| **Recipes** | A curated multi-cuisine collection ranked by how much you already own. **Live serving scaling** rescales ingredients in real time. Save favourites, add missing to the list, and a step-by-step **Cook mode** that deducts from your pantry. |
| **Explore** | Search thousands of recipes (Spoonacular) plus **Our Kitchen** (the built-in catalog) — full ingredients, steps, images. |
| **Learn** | A library of **cooking guides** (techniques) — searchable, step-by-step, by difficulty and time. |
| **Meal plan** | A weekly grid with **drag-and-drop** to rearrange meals, plus an AI weekly-plan generator. |
| **Shopping** | Quick-add, build-the-week's-list from your plan, deal matching, and aisle-ordered shopping per store. |
| **Analytics** | Meals cooked, waste rate, estimated savings, and a 14-day cooking-activity chart. |
| **Anywhere** | A **⌘K command palette** — jump to any page, toggle theme, or search the food database and quick-add to your pantry. Warm light/dark themes. |

---

## The food consortium

A queryable reference layer lives in Postgres, shared across all households
(public-read), with typo-tolerant full-text **and** trigram search:

- **`ingredients`** — canonical foods with aliases, conversions, and per-100 g nutrition (USDA, public domain)
- **`foods`** — branded/barcode products (Open Food Facts)
- **`techniques`** — step-by-step cooking guides
- **`recipe_catalog`** — a shared recipe corpus

It powers nutrition estimation, pantry autocomplete, barcode lookup, the Learn
page, and Explore. Seeded out of the box; expand it with the importers in
[`scripts/`](./scripts/README.md) (USDA FoodData Central + Open Food Facts).

---

## Run it

### Web (dev)

```bash
npm install
cp .env.example .env.local        # fill in your Supabase URL + anon key
npm run dev                       # http://localhost:3000
```

### Install as a PWA

Open the site in Safari (iOS) or Chrome (Android) → **Share → Add to Home
Screen**. Launches full-screen with its own icon.

### iOS, Android & desktop

Pantry Pal is one static-export codebase wrapped per platform. Full prerequisites
and commands are in **[`PACKAGING.md`](./PACKAGING.md)**; the short version:

```bash
# iOS (needs full Xcode)
npx cap add ios   && npm run cap:ios          # build + open Xcode

# Android (needs JDK 21 + Android SDK)
npx cap add android && npm run cap:android     # build + open Android Studio

# Desktop (needs the Rust toolchain)
npm run tauri:dev                              # dev window
npm run tauri:build                            # -> src-tauri/target/release/bundle/
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key (safe in the browser; protected by RLS). |

> First sign-up requires email confirmation. After confirming, create or join a household.

---

## Using it (quick guide)

1. **Sign in**, then **create a household** (or join one with an invite code from
   the sidebar → *Invite partner*).
2. **Stock your pantry** — *Add item*, or scan a barcode / snap a photo. Use the
   **+/-** steppers to adjust amounts, **drag** a card onto a zone to move it, and
   **sort** to surface what's expiring.
3. **Cook** — open a recipe, scale it to your servings, tap *Cook now* to step
   through and auto-deduct ingredients; or *Add missing to list*.
4. **Plan the week** — drag recipes onto the meal-plan grid (or let the AI fill
   it), then *Build week's list* on Shopping.
5. **Learn** a technique anytime, and hit **⌘K** to jump around or quick-add an
   ingredient from the database.

---

## Tech stack

- **[Next.js 16](https://nextjs.org/)** (App Router, **static export**) · **React 19** · **TypeScript** (strict)
- **[Supabase](https://supabase.com/)** — Postgres + Auth + Row-Level Security + Realtime + Storage + Edge Functions
- **[Tailwind CSS v4](https://tailwindcss.com/)** with CSS-variable theming (the **AinaDara** warm-paper design system, light/dark)
- **[Zustand](https://github.com/pmndrs/zustand)** state · **[date-fns](https://date-fns.org/)** · **[lucide-react](https://lucide.dev/)** icons
- **[@zxing/browser](https://github.com/zxing-js/browser)** barcodes · **[Open Food Facts](https://world.openfoodfacts.org/)**, **Spoonacular**, **USDA FDC** data
- **Packaging:** PWA · **[Capacitor](https://capacitorjs.com/)** (iOS/Android) · **[Tauri](https://tauri.app/)** (desktop)
- **Testing:** **[Vitest](https://vitest.dev/)** + Testing Library + jsdom + jest-axe (~91% coverage), GitHub Actions CI
- Hosted on **[Cloudflare Pages](https://pages.cloudflare.com/)** (Git-integrated auto-deploy)

---

## Project structure

```
src/
  app/(app)/        authenticated pages: dashboard, pantry, recipes, explore,
                    learn, meal-plan, shopping, analytics
  app/preview/      design-system gallery (?theme=light|dark)
  components/       ui primitives, sidebar, command palette, cook mode,
                    recipe detail, toast, ingredient autocomplete, theme toggle
  lib/              store (Zustand + Supabase actions), data-sync (realtime),
                    auth-context, food-db (consortium client), nutrition,
                    spoonacular, mealdb, stores, utils
supabase/migrations/  schema, RLS, functions, food consortium + seeds
scripts/              data importers (USDA, Open Food Facts) + icon generator
src-tauri/            desktop app (Tauri)
public/               icons, illustrations, manifest
```

---

## Develop

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server. |
| `npm run build` | Production static export to `out/`. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` / `npm run test:cov` | Run the Vitest suite (with coverage). |
| `npm run cap:ios` / `cap:android` | Build + open the native project. |
| `npm run tauri:dev` / `tauri:build` | Run / bundle the desktop app. |

Every change is gated by **type-check + tests + build** (also enforced in CI).

### Data & security

- All tables use **Row-Level Security**; household tables gate on
  `is_household_member()` so members only ever see their own household's data.
  Reference tables (the consortium) are public-read; only the service role writes.
- Store writes go through Supabase and **throw on failure**; the UI surfaces
  errors via toasts rather than silently failing, and optimistic updates revert.
- Realtime keeps every device's pantry / list / plan in sync.

---

## Deploy

Static export — any static host works. We use **Cloudflare Pages** with Git
integration: every push to `main` rebuilds and deploys. See
[`DEPLOY.md`](./DEPLOY.md) for the build command (`npm run build`), output dir
(`out`), and the Supabase auth redirect-URL config.

## Versioning

[Semantic Versioning](https://semver.org/) with a [Keep a
Changelog](https://keepachangelog.com/) [`CHANGELOG.md`](./CHANGELOG.md). Current
version is in [`package.json`](./package.json).
