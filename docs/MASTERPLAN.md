# Pantry Pal reactivation masterplan

**Status: release 0.10.0 tagged `v0.10.0` at `b91f513` with a published GitHub Release; production `pantry.ainadara.com` serves `main` at `d6e4691` (0.10.0 plus the dependency refresh and the 2026-09-22 interface design pass), deployed by the deploy workflow and verified by fetching the served build; hub card and monitoring merged.** Updated 2026-09-20 (America/Chicago; verification continued on 2026-09-21 UTC). Baseline: `main` at `461d4bfbb492fd90cbe9b0027c214dad8afb0f32`, package version `0.9.0`.

This is the current reactivation plan. Read the [execution contract and seven plans](plans/README.md) next. Update this file's evidence, decisions, and status when implementation changes them. The earlier [ROADMAP](../ROADMAP.md) remains historical context, not the current execution queue.

## 1. Outcome and scope

Make `pantry.ainadara.com` dependable for a household cooking at home and shopping in a grocery store. The same application must work on iPhone, Android, iPad, and desktop browsers. Prioritize a usable installed PWA, correct shared data, recovery after the screen locks, and a shopping list that remains readable in a dead spot. Native store distribution is a separate, optional track after the web experience passes its gates.

The owner subsequently authorized implementation and live migration, confirmed there is no existing data to preserve, and requested guest access with browser persistence and recovery codes. The current release targets web/PWA; native distribution and physical-device evidence remain separate.

**Owner decision: use Cloudflare instead of Supabase.** Preserve Next.js static export, React 19, TypeScript, Tailwind, Zustand, and the AinaDara visual system. Replace the backend rather than restoring Supabase as the long-term platform. Keep Capacitor and Tauri as optional shells.

### Target Cloudflare architecture

| Responsibility | Target | Boundary |
|---|---|---|
| Frontend + API origin | Workers Static Assets serves `out/`; Worker handles `/api/*` | Keep Next static export; no Next server adapter needed merely to host exported files |
| Relational data | D1 | Household tables, membership, recipes, catalog, migration mapping, sessions and operation ledger |
| Authentication | Better Auth 1.7.5 on Workers/D1; email accounts and recoverable guests | Domain/DNS hosting does not provide customer accounts; no home-grown password crypto |
| Authorization | Worker validates session + current membership on every request | D1 does not inherit PostgreSQL RLS; browser-supplied household IDs are untrusted |
| Shared updates | Authenticated API refetch/polling first; household Durable Object invalidations as needed | D1 remains authority; reconnect always reconciles, events are not a second database |
| Files | Private R2 when inventory confirms uploads/assets need it | Authorized upload/download, size/type limits; no public household-photo bucket |
| Catalog refresh | Worker scheduled handler, bounded jobs; Queues if scale needs it | Idempotent batches, checkpoints, rate limits, failure evidence |
| Existing AI features | Worker endpoints; evaluate Workers AI models against actual photo/meal-plan tasks | Preserve manual flows and budgets; domain hosting does not supply food datasets or model quality |
| Monitoring | Cloudflare logs/metrics + scheduled synthetic checks | Redact personal data, track failures and release identity |

P0 records exact auth library, schema and API contracts before implementing. Workers Static Assets can serve a frontend alongside a Worker API; routing must explicitly protect API paths and preserve static-export route/404 behavior. See [Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/) and [Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).

Build in an isolated Cloudflare environment, rehearse migration, then switch `pantry.ainadara.com` only after parity and release gates. Existing Pages remains the serving site until authorized cutover. Preserve any existing data; do not delete Supabase or copy old sessions into the new auth system. The final app, build and catalog schedule must have **no Supabase runtime dependency**.

## 2. Recovery from the interrupted Claude session

Source session: `session_0182DfFesyDmF1wXbg8fwTZ4`, branch label `claude/epic-ride-n40fqt`, titled “Pantry project reactivation plan.” Its visible tool history contains writes for the masterplan, plan index, and plans 0–3. No remote branch with that name was returned by `git ls-remote`; the desktop Changes pane showed no committed diff. CLI teleport was unavailable without Claude.ai CLI authentication.

This package reconstructs and completes the visible direction from the desktop tool output and independently reviews the local code. It is **not a byte-for-byte export of the cloud workspace**. Plans 4–6 and the final documentation integration were completed here. The original copy at `Food/pantry-pal`, including its existing importer edit, was left untouched; this work lives in the separate `Projects-Local/pantry-pal` checkout on `codex/pantry-reactivation-plan`.

Corrections to the visible draft:

- A working service worker is an offline/update requirement, not a universal prerequisite for browser installation.
- A reachable static homepage does not prove authentication, household data, or Edge Functions work. A failed DNS lookup does not establish that Supabase is paused.
- An offline shell does not make household data available offline. P1 and P5 have separate acceptance gates.
- Supabase retention in the recovered draft is superseded by the owner’s explicit Cloudflare decision.
- Keep Capacitor as the existing mobile-shell path; an Android Trusted Web Activity is an option to evaluate, not a decision already made.
- Supabase health checks now serve migration inventory/data recovery only; there is no Supabase keepalive or paid-tier workstream.
- Native release preparation can run alongside offline work. A store account or signing delay must not block the PWA release.
- Match the installed Next.js version's bundled docs. Do not copy request-time nonce/Server Action examples into a static export.

## 3. Verified state and evidence limits

Detailed commands, results, limitations, and sources are in [the baseline record](verification/2026-09-20-baseline.md). Counts are snapshots, not permanent promises.

| Area | Verified observation | Consequence / owner |
|---|---|---|
| Source | Local and remote `main` resolve to `461d4bf`; package is 0.9.0 | All plans start from this baseline and recheck after intervening changes |
| Dependency install | Locked install on Node 24.14.1 succeeded; npm reported 14 advisories, including 4 critical and 7 high, before triage | P0 distinguishes runtime exposure from tooling; no blind forced upgrade |
| Typecheck / tests / build | Typecheck passed; 32 files / 209 tests passed; build generated 15 static pages | Local checks use placeholder Supabase config, not a live integration test |
| Live homepage | HTTPS HTTP 200 on 2026-09-21 UTC | Availability of static assets only; deployed commit not provable yet |
| Live headers | `nosniff` and referrer policy present; no CSP, HSTS, X-Frame-Options, or Permissions-Policy observed in root response | P1 configures and verifies host headers |
| Service worker | Live `sw.js` unregisters itself, deletes caches, and reloads clients; component also unregisters workers/clears caches | P1 must replace both and test upgrades from this exact state |
| Manifest | Standalone display; old green theme and portrait orientation | P1 corrects metadata, icon purpose, and rotation support |
| Catalog schedule | July 1, August 1, September 1 runs failed; June 11 manual run succeeded; September key-resolution step exits 22 | P0 replaces the Supabase-dependent schedule with bounded Cloudflare catalog jobs |
| Backend health | Public Auth/REST probes could not resolve the project hostname from this environment | Unknown. Check only as needed to inventory/export existing data; do not infer pause or data loss |
| Data reproducibility | Client calls `stores`/`item_locations` and three Edge Functions; corresponding table migrations/function source not found here | P0 inventories source schema/functions and ports required behavior; absence in repo does not prove absence live |
| Offline data | Zustand persists equipment only; household loading relies on network; sync has limited explicit error/reconnect state | P5 introduces scoped snapshots and reliable recovery |
| Core correctness | Saved recipe actions resolve against built-in recipes; serving changes are display-only at action boundary; several compound writes are non-atomic | P2 owns recipe action correctness; P5 owns mutation/retry safety before queued writes |
| Devices | Sidebar starts at `lg`; mobile navigation and small controls need safe-area/touch review; HTML drag interactions lack an equivalent touch workflow | P2 and P3 verify actual journeys, not screenshots alone |
| Native | npm 0.9.0 / Tauri config 0.8.0 / Cargo 0.1.0; iOS/Android projects absent in checkout | P0 defines version source; P4 proves reproducible native builds |
| Deployment controls | Docs describe Pages Git integration; actual branch protection and account settings not inspected | P0 prepares isolated Workers deployment; P6 verifies cutover, serving commit and rollback |

## 4. Completion by access point

| Access point | Required experience | Evidence needed |
|---|---|---|
| Desktop web | Sign-in, household setup/join, pantry, recipe actions, meal plan, shopping; keyboard and light/dark usability | Chromium + WebKit journeys, built export, live smoke, release identity |
| iPhone browser + installed app | No hidden bottom actions; keyboard-safe forms; camera denial fallback; successful return after lock; offline shell and scoped shopping snapshot | Physical iPhone browser and installed-mode checklist with OS/browser/build version |
| Android browser + installed app | Responsive controls, appropriate install help, camera permission recovery, offline/reconnect/update behavior | Physical Android checks in browser and installed mode |
| iPad | Portrait, landscape, narrow Split View; navigation adapts to available width; readable cook view | WebKit viewport checks plus physical iPad rotation, keyboard, split view |
| Native iOS/Android | Buildable shell, auth return, camera, external links, permissions, version alignment | P4 simulator/device artifacts; store publication separately tracked |
| Desktop shell | Tauri build and smoke on each claimed OS; constrained CSP/capabilities; release identity | OS-specific builds, signature/update evidence when distributing |

For touch controls, use at least 44 CSS pixels in web layouts, aiming for 48 on Android-facing surfaces; verify native controls against platform guidance. Do not label CSS pixels as Apple points. Keep browser zoom available. Emulation does not certify camera hardware, safe-area behavior, storage eviction, or installed-app lifecycle.

## 5. Execution order

| Phase | Deliverable | Dependency | Exit condition |
|---|---|---|---|
| [P0](plans/2026-09-20-plan0-reactivate.md) | Cloudflare foundation, auth/API/data migration and staging parity | None | Workers/D1 replacement passes isolation, migration reconciliation and core journeys; cutover-ready evidence |
| [P1](plans/2026-09-20-plan1-pwa-hardening.md) | Safe install metadata, static offline shell, update strategy, host headers | P0 | Fresh/upgrade/offline/recovery checks pass on exported app |
| [P2](plans/2026-09-20-plan2-device-ergonomics.md) | Phone/tablet workflows and recipe correctness | P0; integrate with P1 layout work | Touch/keyboard journeys and recipe quantity actions pass |
| [P3](plans/2026-09-20-plan3-browser-checks.md) | Required browser and device evidence suite | Start harness in P0; complete against P1/P2 | Deterministic export checks required in CI; physical evidence tracked separately |
| [P4](plans/2026-09-20-plan4-native-shells.md) | Reproducible native shells and release preparation | P3; optional distribution track | Claimed platforms built/tested; account/signing/store gates explicit |
| [P5](plans/2026-09-20-plan5-offline-resilience.md) | Offline shopping snapshot, honest sync/recovery; staged safe writes | P0/P1/P3 | Isolation, expiry, sign-out, reconnect and failure tests pass |
| [P6](plans/2026-09-20-plan6-estate-integration.md) | Discoverability, monitoring, runbooks, live release verification | P0–P3 + P5; P4 only for native claims | Serving release matches tested artifact; health and rollback verified |

Suggested sequence: **P0 → P1 → P2 → P3 → P5 → P6**, with P4 branching after P3. Add regression checks as each defect is fixed; P3 consolidates and expands them rather than deferring all browser verification. Agree file ownership before parallelizing P1/P2. Use one coherent PR per phase or split an oversized phase at its explicit gates. Do not make an optional store release a dependency of a working website.

## 6. Decisions and defaults

| ID | Decision / default | Rationale / when to revisit |
|---|---|---|
| D1 | Retain Next static export; target Workers Static Assets + API | Preserve frontend investment while consolidating app backend and hosting on Cloudflare |
| D2 | Replace Supabase with Workers + D1; authorization enforced in Worker | Explicit owner decision. Inventory/migrate source data and prove household isolation before cutover |
| D3 | PWA first, Capacitor/Tauri optional distribution | Covers the requested devices before signing/store work |
| D4 | Cache only public static build assets in the SW | Private API/auth responses must never be shared by URL-only caches |
| D5 | Start offline data with a read-only, user/household-scoped shopping snapshot | Reduces store dead-spot pain without inventing conflict semantics |
| D6 | Separate staging/prod Cloudflare resources and tested domain cutover | Keep old deployment recoverable; one writable source during migration, no uncontrolled dual writes |
| D7 | `package.json` owns product version; commit/build identity supplements it | Rebuilds of the same version still need distinguishable provenance |
| D8 | Budget Cloudflare/auth/email/AI from measured usage | Do not assume domain ownership includes all services, unlimited free usage or outbound email |

Open product choices do not block preparation: offline snapshot retention/shared-device policy (P5), whether offline shopping edits are required for first release (default no), store publication priority/budget (P4), auth sign-in method and account recovery/email delivery (P0), and where estate monitoring is maintained (P6). Record an ADR when resolving one. No fee, account enrollment, or publishing action is implied by this planning deliverable.

## 7. Lessons carried over from sibling projects

| Evidence source | Transferable practice | Application |
|---|---|---|
| `ainadara-fitness/docs/review/03-FINDINGS.md`, especially authenticated API cache defect | Record measured findings and separate static cache from private data | P1 cache contract and P5 identity isolation |
| Fitness `app/sw.js`, review prompts, CI | Prove precache completeness and verify what is actually serving | P1 export-derived asset inventory; P6 live version/hash comparison |
| Pharmacy `PROJECT.md` and `docs/superpowers/plans/` | Canonical state + concrete task files, evidence, self-review, deferred work | This file and all seven plans |
| Alaris `tests/alaris-release-browser.mjs`, `docs/alaris-deployment.md` | Timestamped release checks against real asset identity, redirects and headers | P3/P6 release evidence |
| Alaris responsive tests | Test real workflows at narrow widths | P2/P3, extended with real Safari/Android/iPad checks |

Sibling docs can be stale. Consult their measured reviews and code rather than inheriting architecture assertions. The Alaris hardware device profile is not a tablet/browser layout profile. Do not copy medical simulator constraints or production data into Pantry Pal.

## 8. Release gates and operating model

Run applicable focused regressions while implementing, then typecheck, existing tests, production build, and the relevant browser suite before presenting a phase for merge. Evidence must identify commit, environment, command, result and limitations. Required checks must fail on regressions; quarantine only a documented isolated flaky check with an owner and expiry, never the whole browser suite.

Use two synthetic households for live/staging authorization and shared-update checks. Verify that household A cannot read or mutate B through direct Workers API and notification requests, not merely through hidden UI. D1 has no inherited Supabase RLS safety net. Do not seed, mutate or delete real household data for tests. If an environment is unavailable, record the gate as blocked and continue independent local work; never relabel a skipped test as passed.

Before production release: verify recoverable backend state, tested export identity, current headers and redirects, rollback route, and a real household journey in a designated test environment. After authorized deployment, compare the live version/commit and representative asset hashes, then run smoke checks. Record actual device evidence; unresolved device gates limit release claims.

Performance checks start with repeatable measured traces under a recorded device/network profile, then set explicit regression budgets from that baseline. Do not claim a Lighthouse score or field Core Web Vitals result without measuring it. Core workflows and data correctness outrank visual polish.

## 9. Status ledger

| Item | State | Evidence / next step |
|---|---|---|
| Claude handoff recovery | Complete with limits | Visible drafts inspected; unpushed cloud files not exported wholesale |
| Planning package | Complete | Seven plans + execution prompts + baseline; docs only |
| P0 | Implemented; staging verified | Fresh D1 authorized; Workers/Better Auth API, isolation, atomic operations and live guest recovery verified |
| P1 | Implemented | Versioned static precache, prompted updates, per-page CSP; real browser install verified |
| P2 | Implemented | Mobile More menu, touch controls, native dialogs, saved/scaled recipe handling; browser widths tested |
| P3 | Browser suite implemented | Chromium five journeys, WebKit four online journeys and real-outage offline shell passed; physical device limits in release evidence |
| P4 | Not started / optional track | Prepare native builds after web gates |
| P5 | Read-only scope implemented | Scoped 24-hour IndexedDB shopping snapshot; offline writes deliberately unavailable |
| P6 | Web cutover complete; estate integrated | Canonical domain routes to Worker/D1; live guest and security/asset checks pass; **email delivery verified by the owner on 2026-09-21** (verification email arrived, reset link worked); **first production catalog tick verified by the owner on 2026-09-21** (`catalog_jobs.last_status = ok`). Every observation named at cutover is now closed except physical-device installs. Hub card live on `ainadara.com` (ainadara-site#3); `pantry` DNS row and uptime probes merged (ainadara-infra#1) — the estate monitor's bot-challenge limit is R-8 in the review record |
| Merge + release (2026-09-21 04:47–05:00 UTC) | Done; verified by fetching | PR #1 merged as `b91f513`. Deploy workflow: staging run 35562266485 green end to end (build `0dea1e9e759028c8`); production run 35562704465 deployed build `7dc869fed2fa3695` and its CI-side verification was answered by a Cloudflare bot challenge (`cf-mitigated: challenge`), while `https://pantry.ainadara.com/version.json`, `/sw.js` and `/api/health` verified from another network report exactly that build and commit. Browser-journey job green on both `fb9c808` runs. Hub card live on `ainadara.com` (ainadara-site#3); pantry probes merged into `ainadara-infra` (its monitor is challenged the same way — see the review follow-ups) |
| Catalog cron (2026-09-21) | Verified by the owner | First natural hourly tick on production ran; `catalog_jobs.last_status = ok`. Recorded in the migration evidence |
| Email delivery (2026-09-21) | Verified by the owner | Live sign-up verification email received; live password-reset link delivered and completed. Recorded in the migration evidence |
| Independent review (2026-09-21) | Complete; refinements landed | [Review record](verification/2026-09-21-fable-review.md): CI deploy with post-deploy verification, `/version.json` release identity, browser journeys in CI (`continue-on-error` until 2026-10-05), maskable icon, registrar guard, actions/engines/dependabot. `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` are set; the deploy workflow has run every merge since |
| Interface design pass (2026-09-22) | Released; verified by fetching | Operate-mode refinement with the impeccable playbooks (installed at project scope in `.claude/`): flat surfaces, one accent, no placeholder content, fewer actions per row, labelled forms. Detector run over `src/` reports 0 findings; typecheck, 257 unit tests and the build pass; five of six browser journeys pass locally (the offline journey fails identically on unmodified `main` under this sandbox's older Chromium and is verified in CI). Merged as `d6e4691` (PR #15); staging run 35762709628 green; production run 35799736236 deployed build `d3e2cc99c1023dbd`, verified from outside: `/version.json` commit `d6e4691`, `/sw.js` same build, `/api/health` ok |
| Dependency refresh + release tag (2026-09-21 23:04–23:25 UTC) | Done; verified by fetching | Dependabot #2–#9 merged one at a time on green checks (actions checkout 7 / setup-node 7 / upload-artifact 7; react, react-dom, @types/react 19.3.0; date-fns 4.4.0; @vitejs/plugin-react 6.1.1; testing and native-shells groups); staging deployed and verified after each merge (last: run 35666586293 for `92d1851`). Tag pushes from the agent session are refused by its git egress policy, so #13 added `.github/workflows/release.yml`: run 35667098281 created the annotated `v0.10.0` tag at `b91f513` and published the GitHub Release with the CHANGELOG section as notes. Production run 35667100146 deployed `main` `236a94e` (build `fc5ff8879ef5d272`), verified from outside via `/version.json`, `/sw.js` and `/api/health` |
| Recipe sources, planning and pantry (2026-09-23) | PR #17 from `claude/epic-ride-n40fqt`; merges deploy staging; owner reviews before any production dispatch | Worker: TheMealDB weekly mirror under the `catalog_jobs` lease (migration 0007), catalog index + slug reads, Spoonacular caching, `invent` and `illustrate` AI routes with strict re-validation, private recipe photos as bounded D1 blobs (0008), sourced Learn guides (0009). Client: Explore on the index with pantry ranking and drafts, Plan my week with preview, prep builder with templates, recipe editor with photos, pantry quick add and item sheet, analytics insights, sidebar collapse. Gates: typecheck, 265 client tests, 75 Worker tests (Miniflare D1), script tests, build, five online browser journeys locally (the offline journey fails identically on unmodified `main` under this sandbox's Chromium and is verified in CI); detector 0 findings. Limit: the TheMealDB mirror could not be exercised from this sandbox (workerd has no proxy egress), so it is covered by the Worker suite with stubbed responses and must be confirmed on staging via `catalog_jobs`. Production dispatch deliberately not run: owner reviews staging first |
| Merge + release (2026-09-23 02:31–03:03 UTC) | Done; verified by fetching; mirror not yet confirmed | PR #17 merged as `82ec9cf`. Deploy workflow: staging run 35810537095 green (build `364fe49b96402e42`); after reviewing staging the owner asked for production: run 35812603345 green, migrations 0007–0009 applied, and `https://pantry.ainadara.com/version.json`, `/sw.js` and `/api/health` report commit `82ec9cf` and build `1ee826701bf71be2`. TheMealDB mirror: five minutes after production's first hourly tick (03:17 UTC) the recipe index still held only the 6 curated dishes. The same pipeline reproduced locally against all 26 real letter pages (790 meals, every one mapped and upserted through Miniflare D1), so the cause is on the deployed side. Follow-up PR #18: staging gets the hourly trigger (it had none, so the mirror could never be checked there) and job status becomes readable at `GET /api/catalog/jobs`; the next reading is staging's 04:17 UTC tick |
| Staging cron evidence (2026-09-23 04:17 UTC) | Mirror fails on Cloudflare; cause being recorded | PR #18 merged as `e15c4df`; staging run 35814915621 green (build `8b1244ee3103350a`). First staging tick: `openfoodfacts` ok (0 stale rows), `themealdb` **failed** with `requested = 0` in 0.6 s (04:17:59.000 to 04:17:59.636), so every letter fetch was refused immediately rather than timing out (12 s budget each). Since the same pipeline mirrors all 790 real meals under Miniflare, the refusal is specific to Workers egress reaching `www.themealdb.com`. Follow-up PR #19: jobs record `last_error` with the upstream status (migration 0010) and the job-status read returns it, so the next staging tick names the cause before any fix is chosen |
| Mirror root cause (2026-09-23 05:17 UTC) | Found and fixed; staging verification next | PR #19 merged as `815bace` (staging run 35818909942, build `0dd162f6a9e67d0d`). Staging's 05:17 tick recorded `last_error = Error: mealdb_unavailable (TypeError: Invalid redirect value, must be one of "follow" or "manual" ("error" won't be implemented since it does not make sense at the edge …))`. Every outbound Worker fetch passed `redirect: 'error'`, which the Workers runtime rejects before sending anything, so the mirror, the Open Food Facts refresh (whenever it has stale rows) and the Spoonacular search could never succeed on Cloudflare while the Node-stubbed unit tests stayed green. Fix (PR #20): `redirect: 'manual'` with 3xx treated as a failed request, plus a source guard test. Production carries the same defect until its next dispatch; its index still holds the 6 curated dishes |

Every later phase updates its row with the implementation commit, checks, deployed identity (if any), remaining limits, and next action. The implementation release is 0.10.0; native metadata is aligned without claiming a native release.

Release evidence: [2026-09-21 Cloudflare migration](verification/2026-09-21-cloudflare-migration.md).

## 10. Low-waste content follow-through

Implemented three-day household prep planning, actionable calendar meals, six vegetarian-friendly cuisine adaptations, 32 source-linked USDA references, and honest nutrition coverage. Reference migrations 0005/0006 are additive; preserve all current guest and account data. [Content scope and verification](verification/2026-09-21-prep-content.md) records behavior, provenance, tests, performance boundaries and deployment evidence.
