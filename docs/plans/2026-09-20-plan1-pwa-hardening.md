# Plan 1 — PWA hardening

**State:** planned. **Dependency:** P0's Workers API/auth contract and staging export. **Goal:** installable, coherent public static assets with safe updates and an honest offline shell. Household snapshots are P5. Read the masterplan and execution contract first.

## Files and constraints

Existing: `public/sw.js`, `public/manifest.webmanifest`, `public/icons/`, `src/components/service-worker-register.tsx` and test, `src/app/layout.tsx`, `scripts/gen-icons.mjs`, `package.json`, `PACKAGING.md`.

Proposed: `scripts/gen-sw.mjs`, worker asset/header configuration, `public/_headers` where applicable, `src/components/{install-help,update-notice}.tsx`, precache/build tests, browser upgrade fixtures, exported offline fallback. P0's `wrangler.jsonc` and Worker response helpers own API routing/headers. Do not add request-time Next middleware or Server Actions to this static export.

Current code intentionally destroys the old SW to recover stale chunks. Replace both the served worker and the unregister-all component. Scope cleanup to app-owned caches. Treat `/api/*`, auth callbacks, account/session endpoints, private files, non-GET requests and external APIs as network-only, regardless of whether they are now same-origin Cloudflare routes.

## Task 1 — Lock down the asset and update contract

- [ ] Inspect the installed Next static-export/PWA/CSP guides. Build the export, inventory HTML, client-navigation payloads, JS/CSS, local fonts/icons and lazy chunks. Include assets required by **offline client navigation**, not just a regex over homepage script tags.
- [ ] Before replacing the janitor worker, create a browser fixture for the currently deployed `sw.js` and a previous cached release. Reproduce the historical stale-HTML/missing-chunk failure. Add two independently built versions A and B so update tests do not merely change a string in the same build.
- [ ] Define precache scope and size budget from measured export size. Cache only explicit public build assets. Do not cache every same-origin GET: API/auth/private files now share the origin. Exclude version metadata, maps/private exports, migration files and unknown paths.
- [ ] Choose a coherent release strategy: a complete build-specific precache is prepared before activation; controlled clients remain on one asset set until a user-accepted reload. Do not combine new network HTML with an arbitrary old chunk set or delete A while open clients still require it.
- [ ] If cache install fails/quota is exhausted, keep the existing working worker. Retain a bounded number of compatible old app caches with evidence-based cleanup. Never clear IndexedDB, auth state, unrelated caches or pending P5 work during a SW upgrade.

## Task 2 — Implement static offline startup and safe updates

- [ ] Generate SW/precache metadata from the built output after build identity is available. Verify every precache URL exists, no entry escapes allowed public paths, and build ID matches `version.json`.
- [ ] Register once in supported browser HTTPS contexts; skip development/native shells as P4 defines. Handle registration failure without blocking sign-in or rendering. Replace the component's blanket unregister/cache-delete behavior and its tests.
- [ ] Implement an offline navigation strategy for the tested static routes with correct trailing slashes and client payload handling. On an unknown route return a truthful fallback/404, not a cached authenticated page or HTML where an API JSON error belongs.
- [ ] Before P5, render a useful offline message explaining which capabilities require connectivity; do not claim cached household data exists. Cold offline first visit must show the browser/offline limitation honestly; only a completed prior installation can supply cached assets.
- [ ] Show an update-ready notice without forcing reload mid-form, camera session or cooking. Wait for user acceptance, coordinate one reload on controller change, and preserve permitted local state. Test multiple tabs, background/foreground, rejected update and interrupted download.
- [ ] Test legacy janitor → new SW, release A → B, failed B install, removed chunk, offline reload, and rollback-compatible release. Ensure `sw.js`/version metadata revalidate and immutable hashed assets have suitable cache policy.

## Task 3 — Manifest, installation and icons

- [ ] Align manifest theme/background with AinaDara tokens, set a stable app ID/start/scope, allow rotation, and retain standalone display. Validate all referenced icon dimensions and generate a genuinely padded maskable icon rather than assuming the ordinary icon is mask-safe.
- [ ] Add current platform-appropriate install guidance with feature detection; handle an available `beforeinstallprompt` only after an explicit user action. Respect dismissal and already-installed state. Do not present an Android event as an iOS capability.
- [ ] Keep installation and offline readiness separate in both UI and docs. Current browser install eligibility is not equivalent to having a SW or cached data. Test browser and installed modes on each supported OS version; record actual behavior rather than prescribing a universal menu sequence. See [Chrome promotion criteria](https://web.dev/articles/install-criteria) and [WebKit web-app changes](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).
- [ ] Generate manifest screenshots from P3's verified layouts when available. Never ship placeholder screenshots that represent unfinished functionality.

## Task 4 — Apply headers at the actual serving layer

- [ ] Map response ownership: static asset responses, Worker API responses, redirects, errors, SW and auth callbacks. `_headers` rules do not replace headers on Worker-generated responses; set those in the Worker. Verify using the staging origin, not just a local generic file server. See [Workers static headers](https://developers.cloudflare.com/workers/static-assets/headers/).
- [ ] Start CSP in report-only on staging; derive required script/style/font/image/connect/worker sources from the export and actual API/native requirements. Account for Next inline hydration and the theme initializer. Use verified static hashes where maintainable within host header limits, or document the minimum explicit inline exception. Never invent per-request nonces for a static export or add production `unsafe-eval` to silence a warning.
- [ ] Keep one authoritative CSP per response; check duplicate/intersecting policies. Match `connect-src` to the Workers API and approved external services, adding WebSocket origin only if deployed. Remove Supabase source allowances from the final migrated app.
- [ ] Add framing protection, MIME protection, referrer policy and permissions policy that allows needed same-origin camera functionality. Add HSTS for the app after confirming HTTPS/cutover; do not change parent-domain preload/subdomain policy incidentally. Test external sign-in redirects and native callback compatibility.
- [ ] Enforce CSP only after representative journeys produce no unexpected violations. API/auth/private file responses must use appropriate no-store/private caching; never cache responses carrying user cookies at the CDN or SW.

## Exit and self-review

- [ ] Export build and focused SW/manifest/header tests pass; browser upgrade/offline fixtures prove coherent asset versions.
- [ ] Sign-in, callback, scanner, images, font loading and client navigation work with enforced staging headers.
- [ ] API/auth/private-file negative-cache tests prove no authenticated response reaches Cache Storage; native skip behavior has a documented contract.
- [ ] Real device installation/startup/update evidence is recorded or explicitly pending; offline data is not claimed before P5.
- [ ] Update masterplan, packaging instructions and changelog. Document emergency rollback that preserves local snapshots/pending work rather than reintroducing indiscriminate deletion.
