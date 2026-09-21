# Independent review of the Cloudflare migration — 2026-09-21

Reviewer: Claude (session `session_0182DfFesyDmF1wXbg8fwTZ4`, the session whose
interrupted plans this branch reconstructed). Target: `codex/pantry-reactivation-plan`
at `c73a26d`, live site `https://pantry.ainadara.com`. Everything below was measured
in this session; nothing is carried over from memory.

## What was verified

| Check | Result |
|---|---|
| `npm ci` on Node 24 (CI) / Node 22 (this sandbox) | installs; `@zxing/library` engine warning gone on 24 |
| `npm run typecheck` (app + Worker) | pass |
| `npm test` | pass (frontend suite) |
| `npm run test:workers` | 7 files, 57 tests pass (real local D1 via miniflare, 45 s) |
| `npm run test:scripts` | 12 pass |
| `npm run build` | 16 routes; PWA identity `32e92a6ad20b8600` before this review's changes |
| Live `/api/health` | `{"status":"ok","platform":"cloudflare"}` |
| Live `/sw.js` | identity `32e92a6ad20b8600`, 153 precached public assets — byte-identical to the local build of `c73a26d` |
| Live headers on `/` | per-page CSP with script hashes, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` |
| Live `/manifest.webmanifest` | paper colours, `orientation: any`, `id`, shortcuts; **no maskable icon** (see findings) |
| Live `/version.json` | **404** — there was no release-identity endpoint (see findings) |
| Live `/offline/`, `/offline-shopping/` | 200; `/does-not-exist/` → 404 page |
| `ainadara.com` hub | still no Pantry card; `ainadara-infra` has no `pantry` DNS row and does not probe the domain |
| Open PR | [#1](https://github.com/refinalophaina-jpg/pantry-pal/pull/1) from this branch, unmerged |

## Assessment

The migration is sound and better than the plans asked for. Specifically: every
household route re-checks membership in SQL (`memberSql`) rather than trusting the
initial `requireMember`; compound writes ride D1 batches with `mutation_assertions`
guards and an idempotency ledger (`operation_receipts`), which closes the non-atomic
writes the baseline flagged; guest recovery stores only a SHA-256 digest, rotates on
use and revokes other sessions atomically; the API strips session tokens from Better
Auth's JSON; request bodies are bounded by streamed size, not `Content-Length`; the
service worker precaches only public exports, never intercepts `/api/`, and its
install is atomic (the exact failure the May 2026 stale-build bug and the fitness
F-2 finding describe). The catalog job has a fenced lease and bounded batches. The
browser suite runs against a real local Worker + D1 with synthetic accounts.

## Findings and what this review changed

| # | Finding | Severity | Change |
|---|---|---|---|
| R-1 | **No continuous deployment and no deploy verification.** Releases were `wrangler deploy` from a laptop; nothing in CI proved the origin served the built artifact. This is the exact gap that left `fitness.ainadara.com` four months stale. | high (process) | `.github/workflows/deploy.yml`: push to `main` deploys **staging** after the full gates; production is `workflow_dispatch` with a typed confirmation. Applies tracked D1 migrations first, then deploys, then **verifies** `/api/health`, `/sw.js` identity and `/version.json` against the artifact it built, with retries. |
| R-2 | **No release identity endpoint.** Verification relied on diffing `sw.js` by hand. | medium | `scripts/build-pwa.mjs` writes `out/version.json` (`version`, `build` = the sw.js identity, `commit`, `builtAt`), excluded from the precache and served `no-store`. `scripts/pwa.test.mjs` asserts both. |
| R-3 | **Browser journeys not in CI.** `tests/app.spec.ts` existed but only ran locally. | medium | `ci.yml` `browser` job: builds, generates `wrangler.ci.json` (the local config minus the Workers AI binding, which `wrangler dev` proxies to the edge and which refuses to start without a login on a non-interactive runner — the first CI run failed exactly there), applies local D1 migrations, starts `wrangler dev`, runs Playwright Chromium; `continue-on-error` for two weeks (remove after 2026-10-05), report uploaded on failure. Verified locally: the CI config starts and answers `/api/health` with no token. |
| R-4 | **No maskable icon.** Android adaptive launchers crop the 512 "any" icon; Chrome's install UI treats a missing maskable icon as a lower-quality install. | medium | `scripts/gen-icons.mjs` renders `icon-maskable-512.png` (mark inside the 80 % safe zone on paper); manifest declares `purpose: maskable`; `build-pwa.mjs` now validates **every** listed icon's file and dimensions (test added for a wrong-size maskable entry). |
| R-5 | Service worker registered on any origin, including a future `capacitor://` / `tauri://` shell where it is unsupported. | low | Registrar skips non-http(s) origins. |
| R-6 | `actions/checkout@v4` / `setup-node@v4` on the Node 20 deprecation path; no `engines`; no dependency automation. | low | Actions bumped to v5; `engines.node >= 24`; `.github/dependabot.yml` (monthly, grouped). |
| R-7 | **Estate integration not done** although the P6 ledger reads "web cutover complete": no hub card, no DNS row, no uptime probe. | medium | Not changed here (other repositories). Recorded as owner follow-ups below with the exact edits. |

Gates after these changes: typecheck pass; `test:scripts` 12 pass (incl. the two new
assertions); the service-worker component test passes; `npm run build` produces identity
`d0a925e92262218f` with 154 assets and a valid `version.json`.

## Follow-ups (outside this repository, owner or a session with those repos attached)

1. **`ainadara-site`** — add `src/content/threads/pantry.json`:
   `{ "key": "pantry", "label": "Pantry", "host": "pantry.ainadara.com", "glyph": "hearth", "live": true, "order": 4, "blurb": "Household kitchen — pantry, recipes from what you have, three-day prep, shopping.", "version": "v0.10.0" }`
   (`home.json` currently uses `hearth` as a placeholder; pick another glyph for one of them.)
2. **`ainadara-infra`** — `dns/records.md`: add `CNAME pantry → pantry-pal.pages.dev` (proxied; the Worker route `pantry.ainadara.com/*` overlays it). `.github/workflows/uptime.yml`: add `https://pantry.ainadara.com/api/health` and `https://pantry.ainadara.com/version.json` to the matrix.
3. **Repository secrets** for `deploy.yml`: `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit, D1:Edit, Workers Routes:Edit on `ainadara.com`, Zone:Read) and `CLOUDFLARE_ACCOUNT_ID`. Until they exist the workflow fails loudly on purpose.
4. **Branch protection on `main`**: require the `Typecheck · Test · Build` check and a PR. With deploy-on-merge to staging this is the gate.
5. Still unverified per the migration record: email inbox delivery of a real verification link, the first natural hourly `catalog_jobs` tick, physical iPhone/Android/iPad installation, and native builds (P4).
