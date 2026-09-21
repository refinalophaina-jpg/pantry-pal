<div align="center">
  <img src="public/illustrations/logo.svg" width="72" alt="Pantry Pal" />
  <h1>Pantry Pal</h1>
  <p><strong>Cook more · waste less.</strong></p>
  <p>A shared household pantry, shopping list, recipe collection, and meal planner.</p>
</div>

## Current implementation

Pantry Pal now uses **Cloudflare Workers Static Assets, a same-origin Workers API,
D1, and Better Auth**. The frontend remains a Next.js static export. There is no
Supabase dependency in the application runtime, and the browser needs no public
backend keys.

The owner confirmed that there is **no existing household or account data to
preserve**. This installation initializes fresh D1 databases with reference data;
it does not import old accounts or passwords. The historical `supabase/` files
remain migration context, not deployment instructions.

Live application: **https://pantry.ainadara.com**. Release 0.10.0 was deployed and
its guest recovery journey verified on 2026-09-21 UTC. See the
[release evidence and remaining device checks](docs/verification/2026-09-21-cloudflare-migration.md)
and [deployment procedure](DEPLOY.md).

The [masterplan](docs/MASTERPLAN.md) and [phase plans](docs/plans/README.md)
retain the broader reactivation roadmap. Native distribution and extended
offline workflows still have their own acceptance gates.

## Features

| Area | Current behavior |
|---|---|
| Accounts | Email/password sign-in, required email verification, verification resend, password recovery, and revocable D1-backed sessions. |
| Guests | Start without email, keep a browser session, and optionally create a recovery code to restore the same household on another browser. |
| Households | Create a household or redeem an invite. The API checks membership for household reads and writes. |
| Pantry | Quantity, storage zone, expiry, barcode lookup, and food-photo suggestions for manual review. Photo recognition uses Workers AI. |
| Recipes | Built-in recipes, World recipes from TheMealDB, serving scaling, favourites, cooking steps, and shopping-list actions. |
| Meal planning | Weekly planning and a Workers AI suggestion endpoint constrained to the supplied recipe IDs and meal slots. |
| Shopping | Shared list, recipe-based additions, store/aisle ordering, and a separate read-only saved list. |
| Reference data | D1 ingredients, foods, cooking techniques, and recipe catalog; importer tools populate the shared reference tables. |
| Updates | Devices refresh while visible, after writes, and on resume, with retry/backoff after failures. This is polling, not a realtime subscription. |

Explore opens with the D1 catalog and bundled recipes; no external recipe secret
is needed. World recipes, cuisine browsing, and name searches can add TheMealDB
results, with local recipes retained on provider failure. The existing
Spoonacular endpoint is optional and unused by the default UI; configuring
`SPOONACULAR_API_KEY` alone does not change Explore's sources. AI and external
catalog availability depend on the configured account and upstream services.

## Run locally

Use Node.js 24 and the checked-in lockfile.

```bash
npm ci
cp .dev.vars.example .dev.vars
# Replace BETTER_AUTH_SECRET in .dev.vars with a random secret of at least 32 characters.
npm run cf:migrate:local
npm run build
npm run cf:dev
```

Open **http://localhost:8787**. Wrangler serves both the static export and API.
`npm run dev` starts the Next.js UI development server on port 3000; it does not
provide the Workers API. Rebuild the export to test frontend changes through
Wrangler.

Authentication tests use mock email delivery. Local password enrollment is disabled while
`AUTH_EMAIL_ENABLED` is false; a registered sending domain and a working `EMAIL`
binding are required before enabling it. Verification is never bypassed because
email delivery is unavailable. See [DEPLOY.md](DEPLOY.md) for staging setup.

**Continue as guest** works without email delivery. Guest pantry data saves to D1;
the browser keeps a seven-day, renewable HttpOnly session cookie. It is not a
browser-only database. Create a recovery code from **Guest recovery code** in the
account menu before signing out, clearing browser data, or moving devices. Only
the code's SHA-256 digest is stored on the server; save the displayed code somewhere
private. Recovery replaces the code and revokes the guest's previous sessions.
Without a saved code or active session, that guest account cannot be recovered.
The optional saved shopping snapshot below remains read-only offline.

## PWA and offline use

The build generates a versioned service worker and CSP headers for each exported
HTML page. It precaches public static files, omits cookies during installation,
and bypasses `/api/`, non-GET requests, and third-party requests. A waiting update
shows **Reload and update** so users can finish edits first.

After an authenticated shopping refresh, the browser may save one household's
shopping snapshot in IndexedDB. **Saved shopping list** is a separate read-only
view, displays its last-sync time, and expires after 24 hours. It cannot check
items, make edits, or queue writes while offline. Signing out, switching a known
identity/household, or discovering lost access clears the saved list. Storage
availability and browser eviction can prevent offline access.

Home-screen installation depends on browser and OS support. Capacitor and Tauri
scaffolding remain in the repository, but native sign-in handoff, device builds,
and store releases are not verified by the web implementation. Follow
[the native plan](docs/plans/2026-09-20-plan4-native-shells.md) before relying on
packaged apps; [PACKAGING.md](PACKAGING.md) contains the existing scaffolding
instructions.

## Development checks

```bash
npm run typecheck
npm test
npm run test:workers
npm run test:scripts
npm run build
```

The Worker suite exercises real local D1 bindings with email/AI providers mocked.
The script suite checks migration/import behavior and PWA cache boundaries.
Browser, device, delivered-email, and production checks are separate evidence;
see [DEPLOY.md](DEPLOY.md). GitHub CI runs the typecheck, frontend coverage suite,
Worker tests, script tests, and build.

## Project structure

```text
src/app/                  application, account, and saved-shopping pages
src/components/           shared UI, barcode scanning, and update prompt
src/lib/                  API client, auth context, store, sync, offline snapshot
workers/api/              authentication, authorized data API, providers, catalog job
migrations/auth/          Better Auth, rate-limit, and guest recovery tables
migrations/d1/            domain schema and reference-data seeds
scripts/                  tracked migrations, importers, icons, PWA/header build
public/                   manifest, service-worker source, offline page, assets
src-tauri/                existing desktop scaffolding
```

The stack is Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand, Better Auth,
Cloudflare Workers/D1/Workers AI/Email Service, and ZXing. Tests use Vitest,
Testing Library, Node's test runner, and Miniflare. Household authorization lives
in the API and SQL predicates; D1 does not provide the old PostgreSQL RLS model.

## Deploy and maintain

[DEPLOY.md](DEPLOY.md) documents explicit local, staging, and production commands,
bindings, secrets, email activation, and release checks. Serve this application
through the Worker: uploading `out/` to an arbitrary static host does not provide
its authentication or data API. No Pages Git integration is assumed to deploy
the Worker.

Reference-data import commands are in [scripts/README.md](scripts/README.md).
The Worker also contains a bounded hourly Open Food Facts refresh with job status
stored in D1. The current package version is in [package.json](package.json);
release notes belong in [CHANGELOG.md](CHANGELOG.md).
