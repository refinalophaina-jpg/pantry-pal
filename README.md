<div align="center">
  <img src="public/illustrations/logo.svg" width="72" alt="Pantry Pal" />
  <h1>Pantry Pal</h1>
  <p><strong>Cook more · waste less.</strong></p>
  <p>A shared household kitchen app — smart pantry inventory, recipes from what you already have, meal planning, a deal-aware shopping list, and waste analytics. Installable on iPhone as a PWA.</p>
  <p>🌐 <a href="https://pantry-pal.pages.dev">pantry-pal.pages.dev</a></p>
</div>

---

## What it does

Pantry Pal is built for a household (you + partner/roommates) sharing one kitchen. Everyone in a household sees the same pantry, shopping list, and meal plan in real time.

| Area | What you get |
|------|--------------|
| **Dashboard** | Today's planned calories, expiring-soon items, "cook with what you have", local deals, quick actions. |
| **Pantry** | Add items by hand, **scan a barcode** (real product lookup), or snap a photo. Track quantity, unit, storage zone (pantry/fridge/freezer), and expiry. Use / waste tracking feeds analytics. |
| **Recipes** | A curated multi-cuisine collection (see below), ranked by how much of each recipe you already own. Save favourites, "add missing to shopping list", and a step-by-step **Cook mode** that deducts ingredients from your pantry. |
| **Explore** | Discover dishes worldwide via [TheMealDB](https://www.themealdb.com/) — search, browse by cuisine, view full recipes with images and video. |
| **Meal plan** | Drag recipes onto a weekly grid; today is highlighted. |
| **Shopping** | Quick-add, smart-fill from low stock, generate from a recipe, auto-matched against local deals. Deal rows link out to a live price comparison. |
| **Analytics** | Meals cooked, waste rate, estimated savings, pantry breakdown by category/zone, and a 14-day cooking-activity chart. |

### The recipe collection — *Chef Pham's Recipes* 👩🏻‍🍳

The built-in recipes are a real, curated set with a vegan/vegetarian lean, spanning **Thai, Vietnamese, Chinese, Korean, Nigerian, Indian, and American** cooking, plus sauces and desserts. Each recipe is tagged by cuisine and diet, carries ingredient quantities/units, and includes step-by-step instructions and per-serving nutrition estimates.

---

## Tech stack

- **[Next.js 16](https://nextjs.org/)** (App Router, **static export** via `output: "export"`) — every page is a static HTML file; all dynamic behaviour runs client-side.
- **[React 19](https://react.dev/)** + **TypeScript** (strict).
- **[Supabase](https://supabase.com/)** — Postgres + Auth + Row-Level Security + Realtime. Household data syncs live across devices.
- **[Tailwind CSS v4](https://tailwindcss.com/)** with CSS variables for theming (light/dark).
- **[Zustand](https://github.com/pmndrs/zustand)** for client state.
- **[@zxing/browser](https://github.com/zxing-js/browser)** for barcode decoding; **[Open Food Facts](https://world.openfoodfacts.org/)** for product lookup.
- **[lucide-react](https://lucide.dev/)** icons; hand-authored SVG illustrations.
- **PWA** — web manifest, app icons, theme colour, and an offline-shell service worker.
- Hosted on **[Cloudflare Pages](https://pages.cloudflare.com/)** (Git-integrated auto-deploy).

---

## Getting started

```bash
# 1. install
npm install

# 2. configure Supabase
cp .env.example .env.local        # then fill in your project URL + anon key

# 3. run
npm run dev                       # http://localhost:3000
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key (safe for the browser; protected by RLS). |

> First sign-up requires **email confirmation**. After confirming, you'll be asked to create or join a household.

---

## Project structure

```
src/
  app/
    (app)/            # authenticated app shell + pages
      page.tsx        #   dashboard
      pantry/         #   pantry + barcode scanner + photo
      recipes/        #   recipe list, filters, cook mode
      explore/        #   TheMealDB discovery
      meal-plan/      #   weekly planner
      shopping/       #   shopping list + deals
      analytics/      #   trends + charts
    onboarding/       # create/join a household
    sign-in/          # auth
    layout.tsx        # root layout, PWA metadata, SW registration
  components/         # ui primitives, sidebar, toast, cook-mode, recipe-detail, …
  lib/
    store.ts          # Zustand store + Supabase-bound actions
    data-sync.tsx     # initial load + realtime subscriptions
    auth-context.tsx  # session, household, sign-in/up, invites
    seed-data.ts      # built-in recipes (Chef Pham's collection)
    nutrition.ts      # built-in + cached nutrition estimates
    mealdb.ts         # TheMealDB client
    use-action.ts     # await + toast wrapper for store writes
    use-mounted.ts    # hydration-safe mount flag
supabase/migrations/  # schema, RLS, functions, grants
public/
  illustrations/      # logo + empty states + hero (SVG)
  icons/              # PWA app icons (PNG)
  manifest.webmanifest, sw.js
```

### Data & security

- All tables have **Row-Level Security**; household-scoped tables are gated by an `is_household_member()` check so members only ever see their own household's data.
- Store writes go through Supabase and **throw on failure**; the UI surfaces errors via toasts (see `lib/use-action.ts`) rather than silently failing.
- Realtime subscriptions keep every device's pantry/list/plan in sync.

---

## Deploy

The app is a static export, so any static host works. We use **Cloudflare Pages** with Git integration — every push to `main` rebuilds and deploys automatically. See [`DEPLOY.md`](./DEPLOY.md) for the full setup (build command `npm run build`, output dir `out`, and the Supabase auth redirect-URL config).

### Install on your phone (PWA)

Open the site in Safari (iOS) or Chrome (Android) → **Share → Add to Home Screen**. It launches full-screen with its own icon and works offline for pages you've already visited.

---

## Versioning

This project follows [Semantic Versioning](https://semver.org/) and keeps a [`CHANGELOG.md`](./CHANGELOG.md) in the [Keep a Changelog](https://keepachangelog.com/) format, updated with every release. The current version is in [`package.json`](./package.json).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server. |
| `npm run build` | Production static export to `out/`. |
| `npm run start` | Serve the production build. |
| `npx tsc --noEmit` | Type-check. |
