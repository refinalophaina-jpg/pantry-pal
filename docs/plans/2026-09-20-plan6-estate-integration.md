# Plan 6 — Estate integration and verified Cloudflare release

**State:** planned. **Dependencies:** P0 migration/staging parity, P1/P2/P3 and P5 read-only offline gate. P4 is needed only for a native distribution claim. **Goal:** switch the verified app to the Cloudflare backend, make it discoverable and observable, and leave an operational handoff with tested recovery.

## Files and boundaries

Existing/preceding-phase: `DEPLOY.md`, `PACKAGING.md`, `README.md`, `CHANGELOG.md`, P0 `wrangler.jsonc`, Worker/D1 migrations, migration scripts, build metadata and CI. Proposed: release verification script/workflow, `docs/verification/releases/`, `docs/operations.md`, estate change record. Confirm actual hub/infra checkout and instructions before edits: the cloud session referenced `ainadara.com` and `ainadara-infra`, but their current deployed ownership is not established merely by those names.

Do not change unrelated DNS, other AinaDara applications, account-wide policy or parent-domain security settings. Preserve a single authoritative writable backend at every cutover stage. Signed native/store release is tracked separately.

## Task 1 — Assemble a release candidate and operational contract

- [ ] Build the candidate from a known commit with frontend version, backend API/schema version, full commit/build identity and migration manifest. Check Node/dependency audit exceptions are documented. Verify staged artifact matches that identity and contains no service secrets or legacy Supabase runtime endpoints/SDK paths.
- [ ] Complete the P3 device matrix required for the release claim and P5 snapshot/reconnect tests. Validate two synthetic households using actual Workers authorization/D1 operations, shared-update reconciliation and signed-in/out caching behavior.
- [ ] List all Cloudflare resource bindings separately for development/staging/production: D1 database, R2 only if used, DO namespace if used, jobs/queues, auth settings, secrets by name, custom domain and observability. Prevent preview builds from reading/writing production resources.
- [ ] Record app-auth setup/recovery/mail or identity-provider prerequisites, D1 migration command and backup/recovery method, catalog schedule, restore owner and incident playbook. Test recovery against a disposable copy; do not infer it works from a backup checkbox.
- [ ] Estimate expected Workers/D1/R2/DO/Queues/AI/auth-email usage and verify current limits/pricing from official account/docs at implementation time. Establish a project budget/alert owner without inventing free-tier guarantees or enabling paid services implicitly.

## Task 2 — Rehearse and execute the authorized data/domain cutover

- [ ] Use P0's idempotent export/import rehearsal and reconciliation evidence: per-table counts, sampled semantic hashes, ownership links, invite state, storage manifests, recipe IDs, quantities and historical usage. Source data remains private; store only sanitized summaries in Git.
- [ ] If source data cannot be reached, do not silently start an empty replacement. Prepare the full app with synthetic data and explicitly resolve whether to recover existing data or intentionally start fresh before production data cutover.
- [ ] Enforce the source write freeze at its database/API authorization boundary: existing installed clients call Supabase directly, so a maintenance screen or new Worker response cannot fence them. Suspend the old catalog schedule and every service-role/importer writer **before** the final snapshot; verify with stale client credentials that source mutations are rejected while permitted export reads work. Use a reversible, rehearsed source-side control and record its restoration procedure. Then take the final snapshot, apply the final import/delta once, and reconcile. Old clients and pending operations must receive a clear unavailable/update path; never leave two writable authorities.
- [ ] Prepare exact Cloudflare custom-domain/route and Pages-binding changes in the runbook. Rehearse on a nonproduction hostname; validate certificates, API-first routing, auth callback URLs, static trailing-slash/404 behavior and headers. Avoid overlapping routes that bypass authentication or serve HTML for `/api/*`.
- [ ] Once release/cutover is authorized and gates pass, point `pantry.ainadara.com` at the tested Workers Static Assets/API deployment, enable the new job schedule, and retire the **old** Supabase-dependent workflow from active scheduling. Preserve its history for migration evidence. Require fresh authentication under the new identity mapping; do not import old access/refresh tokens.
- [ ] Immediately fetch live version/backend identity and compare representative HTML/JS/CSS/SW hashes to the tested artifact. Run root/sign-in/direct-route/404/API unauthenticated/authenticated smoke, CSP/cache checks, synthetic household flow, two-device update, and old-installed-client migration/update checks. Fail the release record if serving identity differs.
- [ ] Confirm no active frontend, native build, cron or CI path requires Supabase. Keep the former backend/data recoverable for the agreed retention period; this phase does not delete it or cancel accounts.

### Rollback rule

Before accepting new Cloudflare writes, routing back to the preserved old deployment can be a straightforward rollback if source remains unchanged and compatible. **After new writes, switching the domain back alone loses or forks data.** Freeze writes, inspect the failure, prefer a forward fix, or use a rehearsed reverse reconciliation into a compatible backend before routing back. Document who decides, retained data window, compatible schema boundaries and user messaging. Never overwrite newer D1 data with an old snapshot automatically.

## Task 3 — Hub and infrastructure integration

- [ ] Verify the owning hub repository/content schema and existing card patterns. Prepare a Pantry card using `https://pantry.ainadara.com`, an accurate description and an available-state label. Use screenshots/assets from the verified app. Do not advertise native store links or offline mutations before they exist.
- [ ] In the actual infra source, record the custom-domain/route owner, hosting/API architecture, resource names, service status endpoint and operational owner. Do not duplicate generated DNS records by hand or change unrelated records.
- [ ] Add appropriate public site and synthetic backend checks to the estate's existing monitoring approach. Keep household data and privileged health endpoints private; a public health response should not reveal schema, account identifiers or configuration.
- [ ] Open or present separate focused diffs/PRs for sibling repositories with their own validation. Cross-repository publication is a distinct release action governed by the user's current authorization, not a side effect of editing this plan.

## Task 4 — Monitoring that finds meaningful failures

- [ ] Track static/site availability, backend dependency health, auth callback failures, catalog job last success/age, queue dead letters if used, API latency/error rate and unexpected cost growth. An HTTP 200 homepage alone is insufficient.
- [ ] Run a bounded scheduled synthetic test in a dedicated household through the real API. Prefer read-only probes except deliberately isolated test data. Every mutation has an idempotent cleanup/reconciliation strategy; never use real household content as a monitor.
- [ ] Use structured redacted logs with request/build IDs. Do not record password/token/cookie values, full pantry/photo payloads or authentication URL query strings. Select retention/sample rates appropriate to debugging and cost.
- [ ] Alert on meaningful state changes or sustained failures with deduplication/recovery, not every successful probe. Validate one simulated failure and one recovery end to end; record channel and owner without sending test messages to unrelated recipients.
- [ ] Keep a concise incident checklist for auth outage, expired secret, database error, failed import, bad SW update, catalog stall, revoked device and deployment mismatch. Include safe restart/rollback commands with environment names and data impact.

## Task 5 — Finish the handoff and release claims

- [ ] Replace historical README/DEPLOY/PACKAGING guidance with tested Cloudflare commands and actual capabilities. Mark prior architecture as historical, archive superseded docs and update the masterplan ledger. Assign semantic version from delivered behavior; a plan number alone does not determine version.
- [ ] Record known issues with severity, owner, reproduction and next step. Device/store/AI limitations remain visible; do not label them passed based on scaffolding or fixture-only tests.
- [ ] Provide the operator one release record: commit/version/API/schema, resource/deployment IDs, sanitized migration reconciliation, checks/device matrix, monitor evidence, rollback rule and retained-source policy.

## Exit and self-review

- [ ] Actual custom-domain build and API identities match tested artifacts; core live smoke and chosen device gates pass.
- [ ] Data reconciliation is complete, one write authority exists, old clients recover safely, and no Supabase runtime dependency remains.
- [ ] Hub/infra changes are verified or clearly separate pending changes; unrelated sites/routes still work.
- [ ] Monitoring failure/recovery and a disposable recovery drill are recorded. Native release is claimed only where P4 evidence exists.

Official implementation references: [Workers deployments](https://developers.cloudflare.com/workers/versions-and-deployments/), [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [D1 recovery](https://developers.cloudflare.com/d1/reference/time-travel/), [Workers observability](https://developers.cloudflare.com/workers/observability/). Recheck account-specific constraints before cutover.
