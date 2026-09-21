# Plan 5 — Offline resilience on Cloudflare

**Status:** planned; no implementation or offline capability is delivered by this document. **Target:** Workers API as the sole application-data authority, D1 for relational household/membership/session state, and private R2 only if files need retention. The final application has no Supabase runtime dependency. Historical references below are migration inputs. This plan does not promise a product version or release date.

**Outcome:** a household can reopen its last successfully synchronized shopping list when connectivity drops, understand its age, and recover cleanly when connectivity returns. A later, separately enabled stage may allow shopping checkmarks to synchronize safely. Full offline pantry editing, cooking, AI, and household management are outside the initial scope.

## Dependencies and verified starting point

- **Plan 0 / Cloudflare foundation and migration:** establish Workers API routes, authenticated application sessions and household checks backed by D1, data conversion/import in isolated staging, and a production cutover/rollback runbook. Complete authorized online shopping reads/writes in that staging environment first. P5 Stage A must pass before P6 performs production cutover; P5 does not require production migration to have happened. Recover the historical deployed schema and function behavior: `stores` and `item_locations` migrations and three function sources are absent from the repository. This proves a reproducibility gap, not that live resources are missing. Keep D1/storage credentials server-side.
- **Plan 1 / PWA hardening:** deliver a tested, versioned static-shell cache and deployment-update policy. `public/sw.js` currently unregisters itself, and `src/components/service-worker-register.tsx` unregisters workers and deletes caches. An offline data snapshot alone cannot make a cold browser launch work.
- **Plan 3 / browser checks:** provide isolated Cloudflare test identities/households, Worker/D1 fixtures, and browser evidence conventions. Build offline/reconnect scenarios into that suite, then rerun its relevant journeys after each resilience stage.
- `src/lib/store.ts` persists only equipment preferences. Household pantry, shopping, meal-plan, usage, and saved-recipe arrays currently live in memory.
- Historical `src/app/(app)/layout.tsx` requires a user and household before rendering `DataSync`. `src/lib/auth-context.tsx` loads membership through the old backend; a failed query is treated like no household. The replacement session API must distinguish access denial from connection failure rather than carry that behavior forward.
- `src/lib/data-sync.tsx` loads five tables, ignores their query errors, and subscribes without exposing connection status or an explicit reconnect reconciliation. Empty, stale, failed, and loading states can look alike.
- `src/lib/store.ts` currently toggles shopping state by reading local `done` and writing its inverse. The initial shopping schema has no row revision or `updated_at`; it cannot safely resolve queued concurrent edits without a defined policy.

## Cloudflare contract

- [ ] Add a typed same-origin API client, P0’s proposed `src/lib/api-client.ts`, for auth-context, data-sync, and store actions. Replace direct database SDK calls with Workers requests. Derive the actor from the server session, never a browser-supplied user ID.
- [ ] Workers must validate session validity, household membership, roles, object ownership, and input on every protected read/write, including operation-receipt lookups. Enforce cookie/CSRF protections for writes. The former PostgreSQL RLS rules do not protect D1; put explicit authorization predicates in protected queries and test them directly.
- [ ] Initially use primary D1 reads for protected session/membership and household data. If read replication is added later, document its authorization consistency boundary. D1 Sessions provide sequential consistency, not a long-running application transaction; never authorize using a potentially stale unrestricted replica. See [D1 Sessions API](https://developers.cloudflare.com/d1/worker-api/d1-database/#withsession).
- [ ] Define server-owned dataset epoch, household change sequence, row revision, and observation time in the API contract. A restored/imported dataset must not accept old operations merely because a revision matches again. Application sync sequences and D1 replication bookmarks are different concepts.
- [ ] Start with bounded polling while the page is active, plus refresh on foreground, reconnect, and confirmed writes. Select the interval/backoff from observed latency and request budgets, and avoid unnecessary background polling. Do not claim instantaneous realtime delivery.
- [ ] If realtime is justified, add a Durable Object per household for notifications. Authenticate upgrades and validate Origin; check current session/membership before protected delivery and on client messages, close revoked/expired connections, and periodically revalidate. Notifications carry a change hint/sequence; clients refetch through the authorized Workers API backed by D1. Durable Objects support WebSocket coordination and hibernation: [Cloudflare WebSocket guidance](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).
- [ ] Keep D1 as the authority. D1 commit and Durable Object delivery are separate failure boundaries: notify only after commit, and reconcile missed, duplicate, or out-of-order hints through sequence checks and full refetch. Retain bounded polling/reconciliation to recover from lost delivery; do not claim a cross-service transaction.
- [ ] If files are retained, store them in private R2 with D1 ownership metadata and authorized Worker access. Exclude photos and object URLs from the initial snapshot. Do not enable public bucket access for household files; see [R2 public-access controls](https://developers.cloudflare.com/r2/buckets/public-buckets/).

## Stage A — Reliable online reads and a read-only offline snapshot

### A1. Define the data and identity contract

- [ ] Add a short architecture decision record under `docs/decisions/` covering snapshot scope, storage, retention, access, and update behavior before implementation. Choose a finite age limit and show it in the UI; a 24-hour limit is a reasonable starting proposal to evaluate against grocery trips. Record the selected value rather than leaving behavior implicit.
- [ ] Start with shopping items only. Include `schemaVersion`, dataset epoch, user ID, household ID/name, household sequence, `fetchedAt`, and validated minimal items with row revisions. Key by user **and** household. Do not copy session cookies, bearer tokens, email addresses, full API responses, pantry photos, or AI requests.
- [ ] Use a small IndexedDB adapter, proposed `src/lib/offline-shopping.ts`, with atomic snapshot replacement, runtime validation, migration or discard rules, and bounded retention. Keep it separate from the equipment-only Zustand persistence. Handle unavailable storage, eviction, quota failure, and corrupt JSON/data as recoverable states.
- [ ] Write a snapshot only after a successful authorized fetch or confirmed server mutation has established the resulting list. A failed fetch must not erase a usable snapshot or stamp stale data as newly synchronized.
- [ ] Define offline identity explicitly. A cached record is previously downloaded data, not proof of a current Workers application session. Do not manufacture a session or populate live household context from a saved ID to bypass application guards.
- [ ] Purge snapshots on explicit sign-out, account/household changes, confirmed membership loss, expiry, and incompatible dataset epoch. Propagate invalidation to other tabs; cancel or generation-check pending fetches so a late response cannot repopulate another user's cache.
- [ ] State the unavoidable limit: a disconnected device cannot discover remote membership/session revocation immediately. On the next successful online check, purge denied household data before mounting live views or sending writes. If immediate remote revocation of disconnected reads becomes required, disable snapshots; server authorization cannot erase disconnected browser storage.

### A2. Make authentication and synchronization states honest

Targets: `src/lib/auth-context.tsx`, `src/lib/data-sync.tsx`, `src/app/(app)/layout.tsx`, `src/lib/store.ts`, the new API client, and Plan 0's Worker route modules.

- [ ] Separate a confirmed absence of household membership from a network/query error. Offer retry or the permitted cached view for connection failures; do not route an existing household user to onboarding merely because the query failed.
- [ ] Model initial loading, synchronized, reconnecting, stale/offline, and failed states. Track the time of the last successful shopping synchronization and expose it to the UI. Treat `navigator.onLine` as a hint, with request/channel results determining readiness.
- [ ] Add bounded request timeouts and retry/backoff where appropriate. Protect against responses from an old user/household; clear live arrays when switching identity before fetching another household.
- [ ] On reconnect and foreground resume, revalidate the application session/membership through Workers, fetch authoritative data, compare epoch/sequence, then replace the matching snapshot. Initially replace the full small shopping list to reconcile deletes; an incremental approach must define tombstones, cursor retention, and full-resync behavior.
- [ ] Define ordering between initial fetch, polling, mutation responses, and optional notification hints so a slow old response cannot overwrite newer confirmed data. Test delayed responses and notification gaps separately; a connected socket does not establish data freshness or continuing authorization.
- [ ] Keep unrelated table failures isolated: an unavailable recipe query should not silently present a blank shopping list or falsely mark it synchronized.

### A3. Render the cached shopping view without activating live writes

Targets: `src/app/(app)/shopping/page.tsx`, `src/app/(app)/layout.tsx`, a new small cached-shopping component, and optionally an exported `src/app/offline/page.tsx` route.

- [ ] Separate list rendering from `useSyncedActions` and live store-management effects so a cached view can mount independently of live household actions. Preserve the normal authenticated route for online use.
- [ ] Provide a deliberate transition from an offline auth/sync error to an eligible cached shopping view. An explicit sign-out or a detected different account must never take this transition. A first visit with no snapshot shows a useful unavailable state.
- [ ] Display “Offline — last synced …” with the actual snapshot time. Mark the initial snapshot as read-only and keep retry/reconnect access visible. Do not show a success toast suggesting a server write occurred.
- [ ] Disable add/delete/check-off, “Got it,” build-week-list, store editing, AI generation, cooking deductions, and household/invite actions while this view is active. Existing checked rows may be displayed but cannot be changed in Stage A.
- [ ] Offer a clear-data control and an explanation of what remains on this device. Test expiration while the view is open as well as on launch.
- [ ] Coordinate with Plan 1 to cache required static routes, JavaScript, styles, icons, and fonts. Exclude session routes, Workers API responses, WebSocket traffic, protected R2 downloads, uploads, and photos from service-worker response caching. Protect API responses against intermediary/shared caching. Private local data belongs in the explicit snapshot adapter.
- [ ] Make route reload, cold launch after a prior successful visit, a never-visited route, storage eviction, and a deploy between visits separate tested cases. Preserve the prior build's required chunks for its lifecycle or provide an explicit recoverable fallback according to Plan 1's update strategy.

### Stage A acceptance evidence

- [ ] Unit/integration coverage proves snapshot validation, expiry, storage failure, account/household partitioning, sign-out purge, cancellation of late responses, and failed-fetch preservation. Test meaningful behavioral outcomes rather than implementation details.
- [ ] Browser evidence: sign in to an isolated household, create a list, confirm sync, disconnect, close/reopen, and read the same list with an honest timestamp. Verify no household write request is sent from the cached view.
- [ ] Exercise offline startup with a locally available session, an expired/unavailable session, no snapshot, and a snapshot belonging to another user. Show only the records permitted by the documented offline-access contract.
- [ ] Exercise two users in the same browser and two households. After logout/account change, the previous user's content is absent in all open tabs and after reload.
- [ ] Remove membership while the client is disconnected. On reconnect, membership rejection clears cached/live household data and prevents queued or ordinary writes. Document that disconnected read access remains bounded by the previously agreed retention policy until that check is possible.
- [ ] Reconnect after another device adds, updates, and deletes shopping items; the resulting list matches the server. Confirm a fresh successful fetch updates `fetchedAt` and a failed retry does not.
- [ ] Direct Worker/D1 API tests cover cross-household IDs, forged actor IDs, revoked/expired sessions, unauthorized cookie-authenticated writes, and protected file access if files exist. Verify the deployed isolated environment, not only client mocks. Confirm dataset-epoch changes force reconciliation.
- [ ] Run relevant Plan 3 tests on Chromium and WebKit (and Firefox if included in the supported browser matrix), and record installed-PWA behavior on reachable real iPhone/Android devices. Browser-engine emulation does not establish physical-device camera or installation behavior; unavailable device checks stay pending.

## Stage B — Separately enabled offline shopping checkmarks

This is an optional follow-on with its own decision record and release gate. Stage A is useful and releasable without it. Do not automatically turn every Workers mutation into an offline queue.

### B1. Specify conflict handling and the server contract

- [ ] Extend the architecture decision record with a concrete conflict policy. Proposed default: versioned compare-and-set with a visible conflict when another client changed the same item. If the team instead chooses last-writer-wins, state exactly which clock/order wins and show the user the result; never silently rely on device clocks.
- [ ] Limit the first mutation scope to setting an existing shopping item's checked state. Persist the desired boolean, not a `toggle` operation. Explicit setters can be retried without accidentally reversing a checkmark.
- [ ] Define a durable operation: random ID, schema version, dataset epoch, user/household/item IDs, desired state, expected revision, creation-time display metadata, and pending/sending/confirmed/failed/conflict state. Local time is not the conflict authority.
- [ ] Add row revisions, household sequence, and operation receipts in Plan 0's D1 migration directory. Scope the receipt's unique key to authenticated actor, household, and operation ID; bind it to a canonical payload hash. Reject ID reuse with a different payload. Retain receipts at least as long as supported queue lifetime.
- [ ] Apply item change, row revision/household sequence, and durable result receipt together in a tested `DB.batch()` of prepared statements or equivalent supported single-statement design. Cloudflare documents transactional batches and whole-sequence rollback on SQL failure: [D1 batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch). Do not invent an interactive `BEGIN`/`COMMIT` transaction spanning separate Worker awaits.
- [ ] Encode conditions inside that database operation. A compare-and-set updating zero rows is **not** automatically an SQL error: return conflict/denied/missing without a success receipt or sequence advance. Verify this invariant under concurrent remote-D1 requests. A client/server pre-read followed by independent writes is insufficient.
- [ ] Authenticate every replay and receipt lookup in Workers. Derive the actor from the server session and enforce current session/membership, target ownership, epoch, and revision in mutation predicates/transaction so a stale pre-check cannot bypass revocation. Never expose D1/storage credentials to the client.
- [ ] Return the stored result for duplicate accepted operations after a lost response or crash, only to the still-authorized actor/household. Test duplicate IDs and separate operations racing on one revision. Browser locks and notification rooms are not substitutes for D1 atomicity.
- [ ] Send optional Durable Object hints only after commit. If notification fails, leave the committed result intact; polling/refetch recovers it. Do not reapply or roll back a successful mutation because notification delivery failed.
- [ ] Validate household isolation, revoked sessions, removed members, fabricated actor/item IDs, and receipt access through direct Workers API tests against isolated D1, not only a mocked client.

### B2. Build replay and reconciliation

Targets: `src/lib/store.ts`, `src/lib/data-sync.tsx`, the snapshot/outbox adapter, `src/app/(app)/shopping/page.tsx`, Worker mutation routes, and additive D1 migrations.

- [ ] Show local pending checkmarks distinctly from confirmed server state. Keep the authoritative snapshot and pending overlay separate so incoming realtime events do not erase or falsely confirm queued intent.
- [ ] Revalidate session/membership before replay; Workers also enforces it on every operation. Preserve transient failures, pause during authentication loss, and clear inappropriate data on confirmed sign-out, account/household change, or denial. Never replay an old user's queue under a new session.
- [ ] Use bounded retries with backoff and one active replay coordinator. Server deduplication must still protect against multiple tabs/devices or a client crash; a browser lock alone is insufficient.
- [ ] Handle deleted items, conflicting revisions, epoch mismatch, session expiry, rate limits, malformed records, and unsupported queue versions explicitly. Never recreate a remotely deleted item from an old checkmark.
- [ ] After replay, refetch authoritative state and reconcile server confirmations/realtime events by operation identity or revision. Do not announce “synced” until accepted operations are confirmed and conflicts are resolved or clearly surfaced.
- [ ] Add a way to inspect, retry, or discard failed/conflicting pending changes. Clearing device data must warn specifically when it would discard unsent changes.

### B3. Keep compound writes outside the queue

- [ ] Keep cooking, consumption, and moving purchases into the pantry online-only until the migrated Workers API has transactional/idempotent operations. Historical `consumeItem` changes stock before separately inserting usage, and `moveToPantry` inserts stock before deleting shopping. Plan 0 must avoid reproducing these partial-write hazards in D1.
- [ ] Track recipe-ID/unit/scaling correctness as a prerequisite to any future cooking queue: `cookRecipe` currently resolves built-in recipes only and compares quantities without unit conversion, while the recipe detail scales displayed quantities locally. Passing a recipe ID does not transmit the selected serving scale.
- [ ] Do not expand Stage B to these compound workflows merely because the checkbox queue works. Give each additional operation an explicit failure, retry, and conflict contract.

### Stage B acceptance evidence

- [ ] Offline checks survive reload and appear pending. Replaying the identical operation twice, including after the first response is lost, produces one accepted effect and the expected final state.
- [ ] Two clients edit the same item; the documented conflict policy occurs. A client reconnecting after the item was deleted receives a recoverable result without resurrection.
- [ ] A zero-row compare-and-set creates no success receipt, sequence advance, or success notification. Inject failure partway through the D1 batch and verify no partial item/receipt/sequence state remains, locally and against isolated remote D1.
- [ ] Membership revocation and account changes prevent replay. A stale outbox cannot write under a newly signed-in user's session.
- [ ] Simulate a crash after send, a server error mid-queue, session expiry, dataset restore/epoch change, and concurrent tabs. Test revocation racing with replay and duplicate-ID payload mismatch. Confirm no silent loss or false “all synced” status.
- [ ] If notifications are enabled, drop/duplicate/reorder hints and restart/hibernate the Durable Object. D1 refetch/polling must converge without unauthorized subscription delivery.
- [ ] Add Plan 3 browser evidence and Worker/D1 authorization tests. Run repository typecheck, tests, static build, and the Worker suite before release readiness.

## Deployment and rollback

- [ ] Complete Plan 0's isolated staging Cloudflare migration/parity first, with a new dataset epoch and preserved/mapped identities. Do not convert old browser session material into Cloudflare credentials. Remove legacy SDK callers, runtime environment bindings, and backend hosts from the final bundle; core journeys must make no requests to the former backend.
- [ ] Ship Stage A and Stage B separately; Stage B remains disabled until its server contract and failure tests pass. Keep a documented build/configuration switch for each stage and record which setting each release used.
- [ ] Deploy additive D1 changes before enabling the queue client. Keep supported Cloudflare clients and operation-receipt endpoints compatible while pending operations can exist.
- [ ] Coordinate cache/schema versions with Plan 1. A routine service-worker update must not delete the private snapshot/outbox store, and an incompatible schema must fail visibly without sending malformed operations.
- [ ] Roll back within Cloudflare to a compatible Worker/static release. Stage A rollback disables new snapshot access/writes and preserves online operation with targeted cleanup. Never delete all origin storage: it can destroy sessions and unrelated preferences.
- [ ] Stage B rollback stops accepting new queued actions and pauses unsafe replay; it must not silently discard existing pending changes. Provide a recovery or export path appropriate to the recorded operation format before retiring it. Do not drop server deduplication data or revision columns while supported clients depend on them.
- [ ] After database restore, change dataset epoch and require full reconciliation so old operations cannot apply against reset revision history. A database restore is not a routine application rollback.
- [ ] Add release evidence: commit/build, D1 schema/dataset epoch, cache versions, enabled stages, test reports, cold-launch/reconnect recordings, unresolved device checks, and rollback settings. Update README/PACKAGING only to claim verified behavior.

## Completion report for the implementing agent

Report the shipped stage, files and migrations changed, selected retention/conflict decisions, tests and device evidence, any unavailable verification, and operational rollback. Keep remaining stages unchecked. A working cached shell is not evidence of offline household data, and a working offline snapshot is not evidence of safe offline writes.
