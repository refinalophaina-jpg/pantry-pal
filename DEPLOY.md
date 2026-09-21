# Deploying Pantry Pal on Cloudflare

The application consists of a **Next.js static export in `out/` plus the Worker
entry point `workers/api/index.ts`**. Workers Static Assets serves the public
files; same-origin `/api/*` requests run authentication, authorization, D1 queries,
and provider integrations. Supabase is not part of the deployed runtime.

The owner confirmed no existing data needed preservation for the initial migration.
The live D1 databases now hold real account and household data: preserve all of it
during updates. Use tracked, additive migrations; never reset or reseed household
tables. Historical PostgreSQL migrations under `supabase/` are not executable D1 migrations.

## Environments and bindings

`wrangler.jsonc` explicitly defines local, staging, and production configuration.
Do not infer deployment status from a configured name or database ID.

| Target | Worker / canonical origin | Database |
|---|---|---|
| Local | `pantry-pal-local` / `http://localhost:8787` | Wrangler's local D1 state |
| Staging | `pantry-pal-staging` / `https://pantry-pal-staging.refinalophaina.workers.dev` | `pantry-pal-staging` |
| Production | `pantry-pal` / `https://pantry.ainadara.com` | `pantry-pal-production` |

| Binding or setting | Purpose |
|---|---|
| `DB` | Environment-specific D1 database; household and auth tables share this binding. |
| `ASSETS` | Built static export. `/api/*` runs the Worker first. |
| `BETTER_AUTH_SECRET` | Worker secret, at least 32 random characters; use a different value per environment and keep it stable across ordinary deploys. |
| `BETTER_AUTH_URL` | Exact canonical origin. Auth/API requests from another host are rejected; a Workers preview alias is not an additional trusted origin. |
| `EMAIL` | Cloudflare Email Service sending binding, restricted to the configured sender. |
| `AUTH_EMAIL_FROM` | `accounts@pantry.ainadara.com`. Sender creation and DNS readiness are separate from end-to-end delivery verification. |
| `AUTH_EMAIL_ENABLED` | Password enrollment/email recovery gate. Leave false until sending is operational; guests work independently of email. |
| `AI` | Workers AI for photo suggestions and meal planning. |
| `PROVIDER_LIMITER` | Per-user rate limit for provider endpoints. |
| `SPOONACULAR_API_KEY` | Optional legacy recipe endpoint secret. Default Explore does not call this endpoint or require the secret. |

No `NEXT_PUBLIC_SUPABASE_*` variables, service-role keys, or browser-visible
provider credentials are needed. Local secrets belong in ignored `.dev.vars`;
`.dev.vars.example` contains only development placeholders.

## Local application

```bash
npm ci
cp .dev.vars.example .dev.vars
# Replace the placeholder BETTER_AUTH_SECRET in .dev.vars.
npm run cf:types
npm run cf:migrate:local
npm run build
npm run cf:dev
```

Use `http://localhost:8787`. `npm run dev` serves only the Next.js UI development
server; full API behavior needs Wrangler. `npm run build` creates both the export
and the generated `out/sw.js` / `out/_headers`, including public-only precache
entries and per-page hashes for inline scripts. Do not deploy a plain `next build`
output that has skipped `scripts/build-pwa.mjs`.

The auth integration suite creates disposable local users and uses a mock email
binding. Local or staging signup is not unlocked by weakening email verification.

## Schema and seeds

The migration helper applies **`migrations/auth/` first, then `migrations/d1/`**,
tracks them in separate migration tables, and checks foreign keys. Re-running it
applies only migrations not already recorded. Do not run the untracked auth SQL
file manually on an existing database.

```bash
# Local only; this is the default scope.
npm run cf:migrate:local

# Explicit remote targets.
npm run cf:migrate:staging
npm run cf:migrate:production
```

The equivalent explicit interface is:

```bash
node scripts/migrate-d1.mjs --env local --local
node scripts/migrate-d1.mjs --env staging --remote
node scripts/migrate-d1.mjs --env production --remote
```

The helper refuses `--remote` without a named staging/production target. Local
state defaults to `.wrangler/state`; `--persist-to <directory>` can isolate local
experiments. Verify the selected DB name printed by the tool before interpreting
results. Importer configuration and limits are documented in
[scripts/README.md](scripts/README.md).

## Staging deployment and email

Run the checks against the same revision that will be deployed:

```bash
npm run typecheck
npm test
npm run test:workers
npm run test:scripts
npm run build
npx wrangler deploy --dry-run --env staging
```

Set the secret for the selected environment through Wrangler's prompt, then
apply migrations and deploy:

```bash
npx wrangler secret put BETTER_AUTH_SECRET --env staging
npm run cf:migrate:staging
npm run cf:deploy:staging
```

Cloudflare Email Service must have the sending domain enabled and its DNS ready.
The sender `accounts@pantry.ainadara.com` is configured with preview-body retention
disabled. Keep `AUTH_EMAIL_ENABLED=false` until the operator verifies that sending
works; then set it to `true` for staging and regenerate types before deployment.
The binding's structured address uses `from: { email, name }`, as specified by the
[Workers email API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/).

Verify delivery with an address controlled by the operator. Test account creation,
email verification, sign-in, resend, password recovery, expired/reused reset
links, and logout. New password accounts cannot sign in before verification.
Password reset revokes previous sessions. Do not record email bodies, passwords,
cookies, or token-bearing verification/reset links in release evidence.

Guest access uses Better Auth's [anonymous plugin](https://better-auth.com/docs/plugins/anonymous)
and `migrations/auth/0002_guest_recovery.sql`. It is permitted only when the stored
user has `isAnonymous === true`; an unverified registered account still cannot
access household data. Guest sessions use the same seven-day renewable HttpOnly,
SameSite cookie as other sessions. The browser never receives a raw session token
in JSON. Anonymous users are retained when another account signs in; no implicit
transfer of household membership to a different registered account occurs.

Recovery credentials contain 256 random bits. D1 stores only a SHA-256 digest;
the plaintext is displayed once and is never put in a URL or browser storage.
Creating/replacing a code invalidates the previous code. Redeeming it atomically
replaces it and revokes prior sessions, while preserving the same guest user and
household. The recovery page waits for the user to save the replacement before
redirecting. Start, recovery, and code rotation require same-origin JSON POSTs
and have separate rate limits. Keep recovery codes out of logs, screenshots,
traces, release evidence, and support tickets. Loss of both the session and saved
code has no recovery mechanism.

Test guest creation without email, remembered-session reload, household writes,
code replacement, recovery in a fresh browser, and rejection of the old code and
session. Local integration tests exercise a real D1 binding, including concurrent
redemption, cross-household isolation, registered-account rejection, and rate
limits. Deployed-browser evidence is still required separately.

Explore's default Discover and Our Kitchen views use D1 and bundled recipes.
World recipes use the existing TheMealDB V1 integration and its public test key
`1`; upstream errors leave local recipes available. The provider documents this
key for development/educational use and requires supporter access for a public
app-store release; revisit that access before native distribution. See
[TheMealDB's API access terms](https://www.themealdb.com/api.php).

The optional Spoonacular endpoint can still use an environment-specific secret:

```bash
npx wrangler secret put SPOONACULAR_API_KEY --env staging
```

Default Explore no longer calls this endpoint. Setting this secret alone does
not add Spoonacular to the UI; no Spoonacular setup is required for deployment.

## Production cutover

After the staging checks below pass, initialize the production schema, set its
own auth secret, and deploy the reviewed export and Worker:

```bash
npx wrangler secret put BETTER_AUTH_SECRET --env production
npm run cf:migrate:production
npm run build
npx wrangler deploy --env production
```

The production environment declares the exact-host Worker route
`pantry.ainadara.com/*` in zone `ainadara.com`. It overlays the existing proxied
CNAME to `pantry-pal.pages.dev`; the Worker serves every route from its own static
assets or API without fetching that legacy origin. The existing Pages project,
association and DNS record remain intact as a rollback reference. Pages Git
builds cannot replace this Worker route. Verify the live `/api/health`, static
asset hashes and route target after every cutover; deployment output alone is
not sufficient evidence.

Do not remove this route as an ordinary rollback after users start writing to
D1: that would expose the legacy Supabase client again. Prefer a previous
D1-compatible Worker version, or serve maintenance while recovering. Restore
legacy Pages only before new writes or after an explicit data reconciliation.
Neither Worker rollback nor route removal restores D1 data.

Enable production email only after sender verification and confirm the canonical
origin remains `https://pantry.ainadara.com`. Test directly on that domain: API
requests on a `workers.dev` alias will be rejected by the origin policy. Record
the deployed version and verification time. For later releases, export D1 before
schema changes and keep the previous compatible Worker version available;
rolling back code does not undo database migrations or subsequent user writes.

## Release verification record

Release 0.10.0 is live on the canonical domain. The complete measured record,
deployment IDs, exact test counts, rollback boundary and remaining checks are in
[the Cloudflare migration evidence](docs/verification/2026-09-21-cloudflare-migration.md).

The deployed guest journey, remembered cookie, shopping writes, fresh-browser
recovery, replacement code and old-session revocation passed on staging and
production. Both AI providers passed live staging calls. Email sender DNS is ready,
and on 2026-09-21 the owner confirmed on the production domain that the sign-up
verification email arrived and a password-reset link was delivered and worked. Physical-device and native-distribution gates
remain separate from the web cutover.

The production cron is hourly at minute 17 UTC. Each run refreshes a bounded batch
of up to 100 stale Open Food Facts rows; `catalog_jobs` records status and counts.
Check `last_started_at`, `last_finished_at`, `last_status`, `requested`, `updated`,
and `missing`, plus the sanitized `catalog_refresh` log event. A scheduled trigger
in configuration is not evidence of a successful production run; the first natural
production tick was read from `catalog_jobs` on 2026-09-21 and reported `ok`.

Native Capacitor/Tauri builds and store distribution remain a separate track;
web deployment does not complete [P4](docs/plans/2026-09-20-plan4-native-shells.md).

## Continuous deployment (added 2026-09-21)

`.github/workflows/deploy.yml` runs the same gates as CI on the exact revision, applies
the tracked D1 migrations for the target, runs `wrangler deploy --env <target>`, and then
**verifies what is serving**: `/api/health` must report `ok`, and the `VERSION` in the
live `/sw.js` and the `build` in the live `/version.json` must equal the identity of the
artifact the workflow built. A deploy whose origin does not match is a failed run.

| Trigger | Target | Guard |
|---|---|---|
| push to `main` | staging | gates green |
| Actions → Deploy → Run workflow | staging or production | production also needs `confirm = deploy production` |
| Actions → Release tag → Run workflow | annotated tag `v<version>` + GitHub Release | `version` must equal `package.json` at the commit, the commit must be on `main`, and an existing tag is never moved; the notes are that version's CHANGELOG section |

One-time setup: repository secrets `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit,
D1:Edit, Workers Routes:Edit on `ainadara.com`, Zone:Read) and `CLOUDFLARE_ACCOUNT_ID`.
Worker secrets (`BETTER_AUTH_SECRET`) and bindings are not touched by a deploy. The
laptop procedure above still works and is the rollback path (deploy a previous
D1-compatible revision).

If the production verification step reports a Cloudflare challenge (`cf-mitigated:
challenge`), the runner was blocked by the zone's bot protection, not the release: the
step warns and stays green, and you verify from a normal network with
`curl -s https://pantry.ainadara.com/version.json` (its `build` must equal the run's
artifact identity). Allowing the runner past the challenge is a Cloudflare setting —
see R-8 in `docs/verification/2026-09-21-fable-review.md`.

`/version.json` is generated by `scripts/build-pwa.mjs` on every build (`version`,
`build`, `commit`, `builtAt`), is never precached, and is served `no-store` — it is the
one URL to check after any release.
