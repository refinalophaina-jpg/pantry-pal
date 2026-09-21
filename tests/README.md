# Local browser regression suite

Build the static app (`npm run build`) and start the local Worker (`npm run cf:dev`). Supply a local-only `BETTER_AUTH_SECRET` of at least 32 characters in `.dev.vars`; never copy a production secret. The Worker must use `http://localhost:8787` as its configured origin.

Run `npx playwright test`. The setup applies tracked migrations to **local D1 only**, creates verified synthetic accounts using Better Auth's password hasher, and removes their households/accounts afterward. It does not send verification email, call a remote database, or use real user credentials. Test setup and Wrangler dev must share `.wrangler/state`; if dev uses `--persist-to`, set `PANTRY_E2E_PERSIST_TO` to the same path for the test run. `PANTRY_E2E_BASE_URL` may change the localhost port only; remote URLs are rejected.

The suite covers real browser cookies/API writes, mobile and desktop navigation, native-dialog focus, IndexedDB persistence, service-worker offline navigation, read-only shopping, explicit clearing, sign-out across tabs, and household isolation after changing accounts. A guest case creates a uniquely named household, verifies the browser remembers it, recovers it in a fresh browser, saves the replacement code, and checks that prior sessions and the consumed code no longer work. Its local household/user are removed during teardown too. API authorization/operation-race cases are covered separately by `npm run test:workers`. These browser tests simulate offline connectivity; physical iOS/Android installation and keyboard/camera checks still require devices.

For Safari-engine checks, install `npx playwright install webkit`, then run
`PANTRY_E2E_BROWSER=webkit npx playwright test`. Playwright WebKit
`context.setOffline(true)` may abort navigation before service-worker handling;
keep this distinct from physical Safari offline verification. See the release
evidence for observed results.
