# Plan 3 — Browser and device verification

**State:** planned. **Dependency:** P0 baseline harness and migrated API; complete against P1/P2. **Goal:** required automated evidence for the built application, plus an honest record of physical-device checks. This consolidates regressions added during earlier phases.

## Files and commands

Proposed: `playwright.config.ts`, `tests/browser/`, reusable synthetic household/API fixtures, `scripts/screenshots.mjs`, `docs/verification/device-matrix.md`, optional `docs/screens/`; edit `package.json` and `.github/workflows/ci.yml`. Adopt the existing P0 browser harness rather than creating a second one. Choose/document one canonical command, proposed `npm run check:browser`, and retain current Vitest commands.

The browser target is the production static export served with the local Worker/asset routing contract, not Next's development server. An isolated deployed Cloudflare staging suite verifies runtime/binding/header differences. Test fixture interception must not leak into production builds.

## Task 1 — Deterministic test architecture

- [ ] Pin the browser runner and browser binaries through the lockfile/CI setup. Keep Node/toolchain aligned with P0. Start a production export + local Worker runtime with predictable ports, readiness check, shutdown and CI failure reporting.
- [ ] Separate three suites: frontend journeys with deterministic API fixtures; real Worker + local D1 authorization/SQL tests; deployed staging integration with synthetic accounts/resources. Only the first may stub network results freely.
- [ ] Seed two separate households, roles/members, recipes, pantry/list rows, invitations, stale sessions and controlled failures. Fix clock/locale/data where assertions depend on them. Ensure cleanup targets only the synthetic namespace; fail closed if environment identification is absent.
- [ ] Do not bypass the actual auth boundary in integration tests. Include account/session expiry, CSRF/origin checks, unauthorized household IDs, revoked membership and invalid invite redemption. Validate direct API calls as well as screen behavior.

## Task 2 — Journey matrix

| Area | Required automated scenarios |
|---|---|
| Bootstrap/auth | Public sign-in; pending/rejected callback; first household; existing membership; expired/revoked session; refresh/lock-like visibility return; backend unavailable |
| Household | Create/join; expired/used invite; two-device update; A cannot read/update B; membership removed during active session |
| Pantry | Add/edit/delete, unit/quantity, sort/zone, manual barcode fallback, permission-denied UI, API failure rollback |
| Recipes/cooking | Built-in and saved recipe, serving scale, missing ingredients, duplicate finish, empty steps, failed compound write |
| Planning/shopping | Non-drag move/remove, week boundaries, quick add, set done, move to pantry with idempotent retry, pending/error status |
| Offline/update | New offline visitor, warmed offline shell, release A→B with open tab, failed cache install, stale chunks, API/private-cache exclusion; P5 snapshot isolation/reconnect when available |
| UI/accessibility | Light/dark, keyboard/focus/dialogs, touch alternatives, reduced motion, long names, 200% zoom, no horizontal overflow/clipped actions |

- [ ] Run desktop Chromium and WebKit, plus responsive projects around phone portrait, tablet portrait/landscape and desktop. Include narrow tablet Split View and mobile landscape; viewport names alone must not imply a real device.
- [ ] Add scanner stream cleanup tests using controlled media stubs; physical camera accuracy/permission remains a separate gate. Assert no leftover tracks on modal close/background and manual-entry fallback after failure.
- [ ] Check browser console/page errors, unexpected API failures and unexpected CSP violations. Preserve expected-failure cases explicitly so real errors are not globally suppressed.
- [ ] For core data flows assert resulting records and refresh behavior, not only toast text. Add fixture cases that would have exposed current saved-recipe/serving bugs.

## Task 3 — CI and usable failure evidence

- [ ] Require unit/typecheck/build and deterministic browser checks before normal merge. Start with a small stable required suite and expand; do not mark the entire browser job `continue-on-error`.
- [ ] Upload sanitized traces/screenshots and command/environment metadata only on useful failure paths. Keep credentials, cookies and private API bodies out of artifacts. Limit artifact retention and use synthetic content.
- [ ] Keep remote staging tests separately identifiable. A missing staging credential/device is blocked, not a passing test; decide which integration gates must complete before release even if not run on every PR.
- [ ] Add meaningful accessibility checks and visual comparisons for stable key surfaces. Do not snapshot every pixel or route count merely to freeze the implementation. Review baseline image changes intentionally.
- [ ] Capture repeatable loading/interactivity/asset-size baselines on a specified device/network profile. Set budgets from measurements and product needs, recording method and variance; avoid unsupported performance claims.

## Task 4 — Physical device release record

Create rows containing device, OS/browser version, build/commit, browser vs installed mode, test date, tester, pass/fail/blocked and artifact. Minimum release targets: iPhone Safari browser + installed, Android Chrome browser + installed, iPad portrait/landscape/Split View, desktop browser. Native shell rows belong to P4.

- [ ] Verify install/open/return from lock, safe areas, soft keyboard, pinch/text zoom, camera allow/deny/retry, background cleanup, cook wake lock fallback, offline warm launch, reconnect and update acceptance.
- [ ] Test two distinct accounts/devices and shared-device sign-out/login. Verify household content is not exposed to the next account or persisted after chosen clearing behavior.
- [ ] Record storage eviction/quota limitations and state clearly which behavior was tested versus inferred. No emulator or WebKit desktop viewport result can certify physical installed iOS behavior.
- [ ] Publish honest release eligibility: a missing physical result limits the device claim; continue local/CI preparation without inventing a pass.

## Exit and self-review

- [ ] Fresh checkout can run the documented browser command against the export and Worker API contract.
- [ ] Required deterministic checks are green; API authorization/migration tests remain distinct from browser fixtures.
- [ ] Tests catch intentional seeded failures in core gates during development (broken API auth, missing chunk, hidden action), without leaving those defects committed.
- [ ] Physical matrix, remaining blocked gates, performance baseline and sanitized evidence are recorded. Update masterplan and runbooks; later phases add their cases to this suite.
