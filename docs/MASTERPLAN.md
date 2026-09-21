# Pantry Pal reactivation masterplan

**Status: Cloudflare release 0.10.0 deployed; live guest recovery verified.** Updated 2026-09-20 (America/Chicago; verification continued on 2026-09-21 UTC). Baseline: `main` at `461d4bfbb492fd90cbe9b0027c214dad8afb0f32`, package version `0.9.0`.

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
| P6 | Web cutover complete; estate integration open | Canonical domain routes to Worker/D1; live guest and security/asset checks pass; email inbox and first cron observation remain unverified. **Still open:** hub card on `ainadara.com`, `pantry` DNS row and uptime probe in `ainadara-infra` — see the review follow-ups |
| Independent review (2026-09-21) | Complete; refinements landed | [Review record](verification/2026-09-21-fable-review.md): CI deploy with post-deploy verification, `/version.json` release identity, browser journeys in CI (`continue-on-error` until 2026-10-05), maskable icon, registrar guard, actions/engines/dependabot. Needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets before the deploy workflow can run |

Every later phase updates its row with the implementation commit, checks, deployed identity (if any), remaining limits, and next action. The implementation release is 0.10.0; native metadata is aligned without claiming a native release.

Release evidence: [2026-09-21 Cloudflare migration](verification/2026-09-21-cloudflare-migration.md).

## 10. Low-waste content follow-through

Implemented three-day household prep planning, actionable calendar meals, six vegetarian-friendly cuisine adaptations, 32 source-linked USDA references, and honest nutrition coverage. Reference migrations 0005/0006 are additive; preserve all current guest and account data. [Content scope and verification](verification/2026-09-21-prep-content.md) records behavior, provenance, tests, performance boundaries and deployment evidence.
