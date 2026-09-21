# Cloudflare migration — release 0.10.0

Verified 2026-09-21 UTC. The owner authorized implementation and live migration,
confirmed there was no existing data to preserve, and requested remembered guest
access with recovery codes. This release creates fresh D1 databases and does not
delete the old Supabase project or Pages deployment.

## Deployed resources

| Resource | Observed value |
|---|---|
| Live application | https://pantry.ainadara.com |
| Production Worker | `pantry-pal` |
| Production version | `8eb03ff9-d04b-4c46-ad69-b50af0c74315` |
| Production route | `pantry.ainadara.com/*`, ID `fadec97199a643ab9a3f313a4aac99da` |
| Production D1 | `pantry-pal-production`, `4795b873-dc22-4f93-a6a0-feb400f80a1e` |
| Staging Worker | https://pantry-pal-staging.refinalophaina.workers.dev |
| Staging version | `4f12c70d-e901-456f-84fc-410e0e4bf168` |
| Staging D1 | `pantry-pal-staging`, `5e76adb1-c413-4a50-bb4c-e98d97f258c5` |
| PWA build identity | `1074ce08da4b6c61` |
| Catalog trigger | Hourly at minute 17 UTC; confirmed in Cloudflare API |

The exact-host route overlays the retained proxied CNAME to `pantry-pal.pages.dev`.
The unrelated Fitness route was unchanged. Production has no Workers preview
alias, and authenticated endpoints require the canonical application origin.

Both remote databases received the two auth migrations and four domain
migrations, with separate tracking tables and passing foreign-key checks.
Reference seeds contain 74 ingredients, 15 guides and six recipes. Distinct
auth secrets were set through private temporary files and those files removed.

## Evidence

| Check | Result |
|---|---|
| TypeScript: application and Worker | Pass |
| Frontend Vitest | 247 tests across 38 files passed |
| Worker tests including real local D1 | 56 tests across seven files passed |
| Importer and PWA scripts | 12 tests passed |
| Production build | 16 static pages; 140 precache assets |
| Dependency audit, including development dependencies | Zero reported vulnerabilities |
| Chromium browser suite | Five journeys passed |
| WebKit browser suite | Follow-up verification recorded below |
| Staging API smoke | 72 checks passed with actual Workers AI photo and meal-plan calls |
| Staging guest UI smoke | 21 checks passed |
| Production guest UI smoke | 21 checks passed |
| Live health and anonymous access | `/api/health` 200 with Cloudflare/D1; household API 401 and `no-store` |
| Live artifact comparison | Service worker and manifest exactly matched; sign-in HTML and nine script assets matched after excluding Cloudflare's injected bot-detection snippet |
| Live security headers | Per-page CSP, HSTS, no-referrer, nosniff, DENY and restricted Permissions-Policy observed |
| Legacy workflows | Supabase auth configuration disabled manually; old catalog refresh already disabled for inactivity; both removed from release source |

Browser journeys cover widths 320, 390, 820, 1180 and 1440; navigation/dialogs;
real shopping writes, checked state and atomic pantry transfer; service-worker
installation and read-only IndexedDB shopping offline; clear/reload durability;
cross-tab signout and account isolation; and guest recovery in a fresh browser.

The deployed guest check creates a new synthetic guest via the public UI,
confirms its secure persistent cookie and selected D1 identity, creates a
household and shopping item, reloads, creates a code, recovers in a fresh browser,
acknowledges the replacement, and verifies the same data. The previous session
and consumed code are rejected. Each remote check removed only its own fixture
users and their households. No real customer data was modified.

Backend tests additionally verify registration/email verification/reset using a
mock sending binding, membership isolation, concurrent/idempotent operations,
guest recovery races, client flag injection, rate limits, origin checks, privacy
of logs, provider output validation and catalog lease ownership. Browser test
recordings are disabled to keep auth/recovery credentials out of artifacts.

Photo recognition uses Cloudflare-hosted `@cf/qwen/qwen3.8-27b`; meal planning uses
`@cf/meta/llama-3.1-8b-instruct-fast`. The photo smoke uses the public app icon and
checks a valid response, not food-identification accuracy. Suggestions still need
human review. Default recipe discovery requires no provider secret.

## Email and limits

Cloudflare Email Service sender DNS was ready with no errors for
`accounts@pantry.ainadara.com`. Message-body previews were disabled. A benign
delivery check to the account owner was accepted/queued, using the Cloudflare
Email Service skill. Inbox receipt and a real emailed verification/reset link
journey were not observed; local auth lifecycle tests are not that evidence.

Physical iPhone/Android/iPad installation, camera hardware, lock/resume and store
distribution remain unverified. Capacitor/Tauri version metadata is aligned, but
no native build or store release is claimed. Offline shopping is read-only and
expires after 24 hours; full offline editing and guest-to-account household
transfer are outside this release.

The scheduled catalog trigger is configured and its handler is tested. A natural
production cron invocation had not occurred at cutover; inspect `catalog_jobs`
after the first hourly tick. The legacy Pages origin remains a historical
rollback reference, not a second write authority.

## Reproduction and rollback

Run `npm run typecheck`, `npm test`, `npm run test:workers`,
`npm run test:scripts`, and `npm run build`. Start the local Worker, then run
`npx playwright test`. Live scripts require disposable fixture permissions:
`SMOKE_AI=1 node scripts/smoke-staging.mjs` is staging-only;
`node scripts/smoke-live-guest.mjs --env staging` or `--env production` uses the
selected canonical site and removes only its newly created guest fixtures.

For future releases, back up D1 before schema changes and deploy reviewed code
with its compatible schema. Prefer a prior D1-compatible Worker version if a
rollback is needed. Removing the route would expose the legacy Supabase client
and must not be used after new D1 writes without maintenance/reconciliation.
See [DEPLOY.md](../../DEPLOY.md) and [ADR 0002](../decisions/0002-cloudflare-release.md).
