# Plan 0 — Reactivate on Cloudflare and prepare the backend migration

**State:** planned; this document creates no resources and migrates no data. **Dependency:** none. **Goal:** establish the baseline, implement and verify a Cloudflare backend in isolation, and prepare a rehearsed migration for P6. The user explicitly rejected Supabase as the future backend. Keep the Next.js static export; move authentication, household authorization, relational data, server functions and catalog jobs to Cloudflare. Domain registration/DNS does not itself supply application authentication or a database.

Read the masterplan and execution contract first. Execute these checkpoints as separate reviewable PRs. P0 ends with staging parity and a migration runbook; P6 performs the live hostname/write-authority cutover after the P1/P2/P3/P5 release gates. Local tests, a new Worker URL or seeded fixtures do not establish that existing household data has been migrated.

## Target and scope

| Concern | Cloudflare target and boundary |
| --- | --- |
| Web delivery | Preserve `next.config.ts` static export and trailing slashes; serve `out/` using Workers Static Assets. Keep the current Pages origin until P6. No SSR/framework migration is required. |
| API | TypeScript Worker serves same-origin `/api/*`, including auth. It is the sole application data access boundary; clients receive no database/platform credentials and cannot issue arbitrary SQL. |
| Identity | Maintained Better Auth on Workers with users/accounts/sessions/verification records in D1, subject to the proof/ADR below. Access is only an alternative for a deliberately closed internal audience, not an assumed family-app identity system. |
| Relational authority | D1 stores households, memberships, invites, inventory, shopping, meals, recipes, usage, store layouts, catalogs and nutrition cache. Start with primary reads/writes; defer replication. |
| Sync | Bounded authenticated polling and foreground/reconnect reconciliation first. Optional Durable Objects broadcast post-commit invalidations; D1 remains the only domain-data authority. |
| Photos | Process recognition uploads without permanent retention by default. Add private R2 only for a defined retention/use case or existing objects that must be preserved; Worker-authorize every object operation. |
| Jobs/AI | Scheduled Worker catalog refresh, with Queues if chunking/retry is needed. Worker routes replace absent Edge Functions; evaluate Workers AI for vision/text with explicit quality/cost gates. Recipe/nutrition sources retain their provider/licensing requirements. |

Workers can combine static assets and API routes. Select Worker-first routing for `/api/*` and any auth discovery/callback routes outside it; preserve export HTML/404 handling. Do not use an SPA fallback that returns HTML for API requests. Verify pinned Wrangler configuration and trailing-slash behavior against the actual build. [Asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [asset configuration](https://developers.cloudflare.com/workers/static-assets/binding/).

Existing targets: `package.json`, `package-lock.json`, `next.config.ts`, `.github/workflows/{ci,refresh-foods,configure-auth-urls}.yml`, `scripts/{import-openfoodfacts,import-usda}.mjs`, `src/lib/{supabase,auth-context,data-sync,store,stores,food-db,nutrition,spoonacular}.ts*`, `src/app/(app)/pantry/page.tsx`, `supabase/migrations/`, `src-tauri/{tauri.conf.json,Cargo.toml}`, `DEPLOY.md`, `CHANGELOG.md`.

Proposed additions: `wrangler.jsonc`; `workers/api/{index,auth,authorization,validation}.ts`; `workers/api/{routes,repositories}/`; `workers/jobs/`; `migrations/d1/`; `src/lib/{api-client,auth-client}.ts`; `shared/api-contracts.ts`; `scripts/migration/`; Worker integration tests; `.github/workflows/check-cloudflare.yml`; `scripts/build-metadata.mjs`; `docs/backend-inventory.md`; `docs/decisions/`; `docs/migration-cloudflare.md`. These are proposed paths, not delivered capabilities. Keep Worker/browser TypeScript and build boundaries explicit so bindings/secrets cannot enter `out/`.

## Checkpoint A — Baseline, inventory and recoverable data

- [ ] Record branch/status/commit and preserve local changes. Read `AGENTS.md` and relevant bundled Next.js documentation. Start with Node 24 (local baseline 24.14.1; installed ZXing requires Node >=24), then align engines/CI after checking all supported toolchains.
- [ ] Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`; record tool versions and warnings. Legacy placeholder configuration proves only the current baseline. Target builds must work without `NEXT_PUBLIC_SUPABASE_*`. Record external-font/network requirements rather than changing assets solely to get green.
- [ ] Capture `npm audit --json` and triage direct/transitive paths and runtime/build/dev exposure. Remeasure the recorded 14-finding local baseline; do not copy the older draft's count. Apply smallest supported fixes in coherent groups, without an unexplained forced upgrade. Verify CI action releases/support.
- [ ] Add a basic built-export browser smoke for sign-in and a fixture-backed household route. Preserve behavior/error evidence before transport changes; P3 extends it.
- [ ] Inventory the live source through authorized read-only access, if accessible: schema/counts, auth providers/users, roles/memberships, functions/triggers/extensions, storage objects/policies, Edge Functions, publication, secret **names**, deployment and catalog history. DNS failure is not proof of pause/deletion; absent tracked source is not proof of absent live functionality.
- [ ] Reconcile every committed migration with deployed reality. `stores` and `item_locations` are called by `src/lib/stores.ts` but lack tracked migrations. `recipe-search`, `recognize-pantry`, `generate-meal-plan` have call sites but no tracked implementations. Recover their owning source/contracts where possible; otherwise document deliberate replacement contracts and fixtures rather than guessing.
- [ ] Build a client-operation-to-table/function/provider-to-new-endpoint matrix. Include photo UI calls, both importers, nutrition, cooking, moving shopping into pantry, auth and invites. Replacing only `src/lib/supabase.ts` is insufficient.
- [ ] Preserve existing production data with a consistent access-controlled export of schema, rows, identity mapping metadata and required objects. Use a maintenance/write freeze or provider-supported consistent snapshot for the final export; paginated REST reads during writes are not consistent. Keep rows/emails/credentials/object bodies out of Git, CI logs and public artifacts. Record capture time, source identity, protected backup location, counts and checksums privately; commit redacted evidence only.
- [ ] Legacy Supabase service-role/secret/management keys are historical migration credentials only: authorize/mask/limit their use for inventory/export and exclude them from new runtime/build/jobs. Do not repair management-key discovery as the future importer architecture. Keep source project and backups intact through verification/rollback; no service deletion is authorized by this plan.
- [ ] If source data is inaccessible, continue synthetic staging/code work but leave data preservation/cutover blocked. Never silently initialize an empty production replacement or assume existing households are disposable.

**Gate A:** reproducible code baseline, complete dependency inventory with named unknowns, and a verified source backup or explicit data-access blocker.

## Checkpoint B — Worker, D1 and application-auth foundation

### B1. Infrastructure and delivery

- [ ] Inspect actual Cloudflare account/zone, Pages project, production branch/previews, DNS, plan/limits and deployment owner read-only before choosing resource names/routes. Domain ownership is not evidence that Workers, D1, email, R2, AI or Queues are configured.
- [ ] Add reviewed Wrangler configuration: API entry, `out/` assets, D1 `DB` binding, separately named local/staging/production environments, tested compatibility date/needed flags, generated binding types. Preview environments must not share production data/secrets.
- [ ] Add scripts for export+metadata, Worker typecheck/tests, `wrangler dev`, local D1 migrations and staging deployment. Use local D1 for ordinary tests and isolated staging for integration; dry-run bundling/configuration before a remote deployment.
- [ ] API requests return JSON 401/403/404 as appropriate, never asset HTML. Set private API `Cache-Control: no-store`, bounded bodies/timeouts, structured redacted errors and request IDs. P1 owns static security headers/cache exclusions. Missing binding/configuration must not look like an empty household.
- [ ] Document deployment secrets by name, scoped permissions and rotation owner. Worker bindings access D1/R2; no database HTTP proxy, platform token, importer credential or auth secret is exposed to browsers/native bundles.

### B2. D1 conversion, not Postgres dump replay

D1 provides SQLite SQL, FTS5 and JSON support; Postgres functions, extensions and RLS are not portable application security. Create versioned `migrations/d1/` and apply explicitly to the selected environment. Preserve `supabase/migrations/` as historical evidence through validation. [D1 SQL/extensions](https://developers.cloudflare.com/d1/sql-api/sql-statements/), [migrations](https://developers.cloudflare.com/d1/reference/migrations/).

| Source feature | Required conversion |
| --- | --- |
| `auth.users`, UUID defaults | Auth-library tables and a stable application user mapping; preserve entity UUIDs as text, generate new IDs server-side, remap every member/creator reference explicitly. |
| Dates/timestamps, boolean, numeric | Document UTC timestamps/date-only ISO values, checked 0/1 values and quantity/money precision; preserve null vs zero and barcode leading zeros. |
| `text[]`, `jsonb` | Validated JSON text or normalized child tables; a Postgres array literal is not JSON. |
| `pg_trgm`, GIN, `tsvector`, `plainto_tsquery`, `ILIKE`, `unnest` | Indexed normalized fields plus FTS5/JSON and bounded prefix/alias search. Define ranking/typo fixtures; FTS5 is not trigram equivalence. Bound/escape query syntax and results. |
| RLS, `auth.uid()`, grants, `security definer` | Authenticated Worker handlers with household predicates on every repository operation; no direct client DB access. |
| PL/pgSQL owner/invite/updated-at triggers | Explicit guarded atomic Worker operations and only justified SQLite triggers. Timestamps/revisions cover every writer; do not copy Postgres `FOR UPDATE` or arbitrary interactive transactions. |
| Realtime publication | Authenticated snapshot/change endpoints, polling and optional post-commit DO invalidations. |

- [ ] Include `households`, `household_members`, `household_invites`, `pantry_items`, `shopping_items`, `meal_plan`, `usage_events`, `saved_recipes`, `ingredients`, `foods`, `techniques`, `recipe_catalog`, `nutrition_cache`, plus reconciled `stores`/`item_locations`. Port later columns, indexes, uniqueness/check/FK/cascade rules and seed provenance.
- [ ] Keep `meal_plan.recipe_id` compatible with built-in/external/saved recipe identifiers, not a guessed UUID FK. Preserve `usage_events.item_id` history after inventory deletion (legacy schema has no cascading FK). Keep barcodes textual. Enforce item-location/store/household consistency with composite constraints and API predicates.
- [ ] Add server row revisions, tombstones or a durable household change log, operation deduplication records, and API/schema/sync epoch for P5. Define retention and full resync when a cursor expires. P0 supplies server guarantees; P5 owns client snapshots/outbox.
- [ ] Index membership and household filters; inspect realistic query plans. Rebuild FTS after import and synchronize inserts/updates/deletes. Test empty/incremental migration and repeat seeds/imports without duplicate IDs.
- [ ] Rehearse foreign-key/import behavior including `foreign_key_check` on disposable D1. Do not assume `foreign_keys=off` or a raw Postgres export works; convert/chunk and validate using current D1 rules. [Foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/), [import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/).

### B3. Authentication ADR and proof

- [ ] Write `docs/decisions/cloudflare-auth.md`: Better Auth on Workers with D1 sessions is the default candidate. Pin a maintained version/supported D1 adapter, generate/review schema and prove the real Worker bundle; Node success is insufficient. Record runtime flags, session/cookie settings, email delivery prerequisites and recovery. Use maintained library password/session/token mechanisms, never custom password crypto. [Better Auth D1/database](https://better-auth.com/docs/concepts/database), [adapters](https://better-auth.com/docs/adapters/other-relational-databases).
- [ ] Preserve expected email signup/signin with verified recovery/verification delivery, or document an explicit product decision before removing it. Verify account availability/configuration of any Cloudflare email sending service first. DNS alone cannot send account mail; console-only recovery links are not production readiness.
- [ ] For web/PWA, use library-managed secure HttpOnly host-scoped cookies with explicit same-site policy, exact trusted origins, CSRF/origin protection, rate limits and session revocation. Disable/bound session caches that could mask revocation; validate auth/membership using current primary D1 state. Estate-wide cookies require a separate reviewed SSO need.
- [ ] Implement `GET /api/me` with identity/memberships/protocol versions and distinct signed-out/no-household/forbidden/unavailable/timeout states. Rework `auth-context.tsx` without mechanically copying the Supabase auth-lock workaround; preserve startup/resume regression coverage.
- [ ] Define legacy identity claiming: private mapping to original application user IDs, verified control of the imported identity, and explicit handling of duplicate/unverified emails. Never link on a client-supplied ID/email alone. Require reauthentication/re-enrollment; do not copy source sessions/refresh tokens or blindly import password hashes. Resolve every member/creator reference before final reconciliation.
- [ ] Prepare P4's native contract: prove the library OAuth provider with public clients, system-browser authorization, S256 PKCE, state, exact redirects, short-lived codes and revocable/rotated tokens. One-time tokens alone are not PKCE. P4 implements platform links/secure storage; neither embedded client secrets nor browser-cookie assumptions are acceptable. [Better Auth OAuth provider](https://better-auth.com/docs/plugins/oauth-provider).
- [ ] Document Access only as the gated internal-audience alternative; it still needs validated identity and household authorization. Do not silently make family users Cloudflare account/team members.

**Gate B:** staging asset/API routing, clean constrained D1 migrations and real-runtime signup/signin/recovery/logout/revocation pass. Missing provider/delivery prerequisites remain blockers, not successful mocks.

## Checkpoint C — Backend parity, authorization and atomic operations

### C1. Replace all client paths

Version typed endpoint/error contracts in `shared/api-contracts.ts` before P4/P5 depend on them. Suggested groups:

| Routes | Responsibilities |
| --- | --- |
| `/api/auth/*`, `/api/me` | Account/session lifecycle and household bootstrap. |
| `/api/households`, `/api/households/:hid/invites`, `/api/invites/redeem` | Household+owner creation, membership lookup/administration, invite issuance/redemption. |
| `/api/households/:hid/{pantry,shopping,meal-plan,usage,saved-recipes,stores,item-locations}` | Scoped validated reads/writes, pagination/revisions; never a generic table proxy. |
| `/api/households/:hid/{snapshot,changes,operations}` | Reconciliation and named atomic consume/cook/move/set-checked operations. |
| `/api/catalog/{ingredients,foods,recipes,techniques}`, `/api/nutrition` | Search/barcode/read/cache; authenticated catalog reads and server/job-only writes. |
| `/api/recipes/search`, `/api/pantry/recognize`, `/api/meal-plan/generate` | Replaced external-function contracts, with identity/household checks and limits. |
| `/api/households/:hid/photos/*` if retained | Private authorized object lifecycle. |

- [ ] Implement `api-client.ts` with bounded requests, JSON error parsing, cancellation and identity generation checks. Never convert 401/403/429/5xx to successful empty arrays. Web uses same-origin credentials; P4 transport follows its validated bearer/origin contract.
- [ ] Replace Supabase queries/RPC/functions/storage in `auth-context`, `data-sync`, `store`, `stores`, `food-db`, `nutrition`, `spoonacular` and pantry photo UI. Convert meaningful builder-mock tests into API behavior plus Worker/D1 integration coverage.
- [ ] Remove both Supabase packages, old client and active env requirements after parity is proven; update CI, scripts, `.env.example` if present and current runbooks. Preserve historical source/export notes clearly labeled. Inspect `out/` and browser traffic for stale source URLs/keys/imports.
- [ ] Define minimum frontend/API versions. Old cached/native clients need an explicit update/read-only state at cutover rather than invisibly writing to the former source.

### C2. Household isolation replaces RLS

- [ ] Derive actor identity only from validated sessions/tokens. Forbid caller-supplied creator/updater/role/ownership fields except defined owner workflows; allowlist patches and prepare/bind all SQL values.
- [ ] Include actor membership **and** target household in each repository read/write, including item-ID routes, bulk actions, exports, photo keys and store joins. Representative rule: `household_id = ? AND EXISTS (SELECT 1 FROM household_members hm WHERE hm.household_id = target.household_id AND hm.user_id = ?)`. `hid` is requested scope; actor ID is server-derived.
- [ ] Put security predicates inside the SQL that changes/returns protected rows, not only an earlier JavaScript pre-check that can race revocation. Check affected rows and return typed forbidden/not-found/conflict results without disclosing another household's existence. Direct cross-household HTTP tests cover every route group.
- [ ] Restrict destructive/membership administration to owners and prevent removing the final owner. Household IDs/creators and issued invite household/issuer/expiry/token hash are immutable through ordinary updates. State who may issue invites (legacy members could); do not accidentally broaden permissions.
- [ ] Generate high-entropy invite tokens server-side and store new token hashes, bounded expiry and redemption limits. Decide explicitly whether legacy invites survive only their original expiry or are invalidated/reissued. Redemption atomically guards unused/unexpired status, claims once and creates a fixed member role for the fixed household. Concurrent actors cannot both succeed; replay by the winner returns its recorded result. Clients cannot extend expiry or assign owner.

### C3. Atomicity and consistency

D1 `batch()` makes the submitted statements transactional; a failing statement rolls back the sequence. Separate awaited statements are not a transaction, and a guarded update affecting zero rows is not an SQL error. Encode dependent guards and inspect results so a failed precondition cannot produce partial success. Sessions/bookmarks provide sequential consistency for replication, not authorization or arbitrary transaction callbacks. [Batch/session API](https://developers.cloudflare.com/d1/worker-api/d1-database/), [read consistency](https://developers.cloudflare.com/d1/best-practices/read-replication/).

- [ ] Implement household+owner creation, invite redemption, consume+usage, cook+all deductions/history, and purchase-to-pantry+shopping removal as bounded guarded server operations. All business preconditions cover the full effect. Deliberately fail a middle step and prove no partial commit; verify any ORM transaction behavior against D1.
- [ ] Include operation ID, actor, household, kind and canonical payload fingerprint. Commit deduplication and domain changes atomically; identical retries return the original outcome, while different payload/actor reuse is rejected. Recheck current membership before even returning stored results. Lost responses must not duplicate inventory/history.
- [ ] Use expected revisions and server-owned revision/change sequences. Shopping accepts the desired boolean, not `toggle`; conflict returns a visible typed response such as 409 rather than silently overwriting. Device timestamps are not write authority.
- [ ] Validate quantity/unit/serving-scale/recipe provenance. Current `cookRecipe` only resolves built-ins and omits detail-page serving scale. Define the corrected compatible request before claiming cooking parity; atomic incorrect deductions are still incorrect.
- [ ] Start with primary auth/private-data reads. If later enabling replication, design bookmark propagation/read-your-write behavior and preserve primary checks for revocation-sensitive decisions; replica lag cannot restore removed membership.

### C4. Sync, external functions and storage

- [ ] Replace Realtime with bounded snapshot/change polling, finite foreground intervals, error backoff/jitter, cancellation when appropriate, and immediate resume/reconnect reconciliation. Expose actual last success/error state; handle missed deletes, cursor expiry and late old-identity responses. P5 adds deliberate private offline storage.
- [ ] Add DO invalidation channels only if latency evidence justifies them. Authenticate upgrades, validate Origin/current membership and derive household object IDs server-side. Revalidate/close on session expiry or revocation. Trusted Worker code publishes only after D1 commit; clients cannot broadcast or mutate through sockets. Send minimal revision hints, then refetch via authorized API; polling repairs lost notifications. Do not duplicate domain records in DO storage. Use Hibernation API and preserve necessary connection metadata across wakeups. [DO WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).
- [ ] Implement the three missing functions in tracked Worker code with schemas, auth, input/image bounds, per-user/household limits, timeouts and redacted logs. Distinguish provider failure/quota/no-match/malformed output. Keep manual/catalog alternatives usable, and never present an unavailable function as successful empty data.
- [ ] Evaluate current Workers AI vision/text models on representative photos/meal requests; record model ID, quality, latency, current limits and cost controls before enabling. Use server bindings and validated output; users review recognized foods/plans before commit. AI does not replace licensed nutrition/recipe sources. [Workers AI binding](https://developers.cloudflare.com/workers-ai/configuration/bindings/).
- [ ] If retaining photos, use private R2, server-generated household keys, authorized reads/deletes, type/signature/size checks, metadata minimization, retention and orphan cleanup. Do not expose public bucket URLs or trust caller object paths. Preserve migrated object mappings/checksums. [R2 from Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/).

**Gate C:** surfaced features have verified Cloudflare implementations or an explicit release-scope decision and honest unavailable UI. Unresolved required parity blocks cutover. Direct isolation, atomic rollback and two-client reconciliation tests pass. P1/P2 may work on fixtures in parallel without claiming live readiness.

## Checkpoint D — Catalog automation and health

- [ ] Preserve historical refresh failure evidence: a management-key HTTP failure proves an error, not its exact cause. Replace `.github/workflows/refresh-foods.yml` source-key discovery/writes with the Cloudflare job contract; do not create a new service-role dependency.
- [ ] Extract shared parsing/normalization from both importer scripts with small fixtures. Production writes use a Worker job with D1 binding; local dry-runs can share parsers. No anonymous admin endpoint or browser platform token triggers imports.
- [ ] Add a Cron scheduled entry with explicit UTC cadence and one active run per source. Store run ID/cursor/state, provenance, success/reject counts, retry reason and last-success timestamps. A safe health endpoint reveals freshness/readiness without credentials or household records. [Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
- [ ] Measure realistic work against current Worker/D1 resource limits. Add Queues when needed for bounded chunks, per-source throttling, transient retries and a dead-letter/recovery path. Delivery is at least once: deduplicate by run/source/item and use deterministic barcode/slug upserts. Do not advance a failed batch cursor as if successful. [Queue delivery](https://developers.cloudflare.com/queues/reference/delivery-guarantees/).
- [ ] Test missing config/provider key, 401/403, 429, transient 5xx, malformed JSON, rejected records, duplicate delivery and partial failure. Preserve source attribution/licensing/rate limits and curated edits using a stated merge rule. Add dry-run/limited-run controls.
- [ ] Execute a bounded staging refresh, compare IDs/counts/content/provenance, repeat it and prove idempotence. P6 disables all legacy schedules/writers before its final source snapshot, then activates/verifies the new production schedule after cutover. Last successful import is independent of a successful schedule trigger.
- [ ] Add read-only `check-cloudflare` diagnostics for build identity and safe API/auth/dependency health, with bounded requests/redacted summaries and failed required checks returning nonzero. Distinguish configuration/auth/D1/provider errors. Use the chosen configured notification channel; a monthly job is not uptime monitoring.

**Gate D:** meaningful failure fixtures and successful bounded staging import, plus explicit production activation and legacy-writer retirement instructions.

## Checkpoint E — Rehearsal, identity and P6 handoff

### E1. Data rehearsal

- [ ] Add migration tools for source parsing, deterministic conversion, ID mapping, chunked import and verification. Manifest fields: export/schema hash, mapping version, source totals, rejects and per-table progress. Reject invalid relations/unknown data visibly; reruns cannot duplicate rows or reset historical timestamps.
- [ ] Rehearse from a consistent snapshot into empty staging D1. Import identity mappings before dependent rows, preserve entity IDs and conflict keys, convert types deterministically and rebuild indexes. Verification flags require source evidence and the claim policy; users still reauthenticate.
- [ ] Compare per-table/per-household counts, ID sets, normalized checksums, FK checks, owner/role counts, nullable creators, quantity totals, timezones/dates, recipe JSON, search and object checksums. Counts alone do not prove preservation. Run import twice.
- [ ] Test migrated synthetic users through re-enrollment/bootstrap/core journeys, including mixed recipe identifiers, deleted-item history, used/expired invites, Unicode, decimal quantities, nulls and barcode leading zeros. Never publish real rows/photos as fixtures/screenshots.
- [ ] Measure freeze/export/import/verify duration and list every source writer: current/old web/native clients, functions and jobs. Rehearse a reversible source DB/API mutation fence and stop catalog/service-role writers; a frontend banner alone cannot stop old direct clients. Prove a stale installed client and a legacy job credential cannot write after the fence, while export/reconciliation still work. If source access is unavailable, final cutover remains blocked.

### E2. Build identity and rollout

- [ ] Use `package.json` as product-version authority. Generate `out/version.json` after successful build with version/full commit or explicit local marker/build ID/UTC time. Report API/schema/sync epoch compatibly. Support CI without `.git`; prohibit secrets/placeholder backend values in the artifact.
- [ ] Show identity on mobile/desktop, align Tauri/Cargo versions through a documented script/check, and serve metadata with revalidation. P1 caches by build identity, not just semantic version. Test missing/mismatched metadata.
- [ ] Inspect actual CI protections and deployment bypasses. Apply D1 migrations deliberately before compatible Worker/client releases; Git deployment does not prove migrations run automatically. Prefer additive changes, isolate staging and retain prior compatible Worker+assets/database recovery metadata.
- [ ] Update `DEPLOY.md`, importer/current architecture docs with Workers/D1 commands, secrets by name, auth/provider requirements, backups, owner and recovery. Label old Supabase instructions source/export history only. Verify current service pricing/limits and prepare an observed-usage budget; do not assume every service is free.

### E3. Cutover/rollback runbook — rehearse here; execute in P6

1. Confirm release gates, backup access, recovery owner and supported clients. Fence source mutations using verified reversible DB/API controls, stop legacy catalog/service-role writers, prove stale-client writes fail, then take the final consistent export/delta.
2. Import/reconcile final production D1 data with the tested manifest. Verify identity mappings and relationships; retain source read-only. Abort for failed counts/checksums/isolation.
3. Deploy compatible Worker+assets/auth/jobs and switch `pantry.ainadara.com` from known Pages routing in P6. Verify TLS/redirects/cookie origins/API responses/headers/version identity, sign-in and two-household isolation on the hostname.
4. Require reauthentication, reconcile/update old clients/caches, verify sync/jobs, and end maintenance with Cloudflare as the sole writer. Record live results and pending device checks.
5. Before new D1 writes, rollback may restore the previous route/artifact and unfreeze source. **After new D1 writes, never blindly switch back to older data:** freeze, preserve/export new changes and reconcile through a verified reverse path or repair forward in maintenance. Keep a change journal/export and rehearse this decision.
6. Prefer reverting compatible Worker/frontend code while D1 remains authoritative. Time Travel/database restore is a separate action with explicit recovery point/writes-at-risk analysis, not an automatic UI rollback. Retain both projects/backups and migration/deduplication history through the rollback window. [D1 recovery](https://developers.cloudflare.com/d1/reference/time-travel/).

## Required evidence and completion

| Area | Minimum meaningful verification |
| --- | --- |
| Build/delivery | Typecheck, unit/Worker integration tests, export/browser smoke; API never falls through to HTML; no legacy runtime dependency/secret in artifact. |
| Auth | Signup/verification/signin/recovery/logout, expiry/revocation/resume, bad origin/CSRF, provider outage, verified legacy claims. Native proof separately under P4. |
| Isolation | Anonymous/A-household/B-household/removed-member direct HTTP tests; forged actor/household/item/store IDs, privilege escalation, object access and catalog writes denied. |
| Atomicity | Concurrent invite claims/owner changes; consume/cook/move partial failures; duplicate/lost-response operations; payload mismatch/stale revisions/multiple devices. No partial effects. |
| Data/search | Empty/incremental migration/import twice, ID/count/checksum/FK reconciliation, dates/decimals/JSON/barcodes/mixed recipe IDs/history/search ranking. |
| Sync | Missed changes/deletes, foreground/reconnect, cursor/epoch expiry, logout/account switch/stale response; optional DO reauth/revocation/hibernation. |
| Jobs/functions | Bounded integration and failures, duplicate deliveries, AI quota/malformed/no-match behavior, private-photo checks/retention, redacted logs. |
| Release/recovery | Staging rehearsal, source write-freeze proof, version checks and rollback exercise before and after simulated new-authority writes. |

- [ ] Record commit/build/schema versions, exact commands/results and redacted evidence links. Separate local success, staging integration, blocked live prerequisites and pending real-device checks.
- [ ] Update masterplan ledger/changelog. Writing this plan does not complete its checkboxes; leave required failed/blocked gates open.
- [ ] Hand P1 routing/cookie/cache boundaries; P2 auth/sync states; P3 isolated test users/contracts; P4 proven native auth contract; P5 revision/deduplication/tombstone/epoch rules; P6 tested cutover/rollback runbook.
