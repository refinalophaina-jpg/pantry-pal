# Reactivation action plans

**These are the original execution plans. Current implementation progress is recorded in the masterplan and verification records.** Start with [MASTERPLAN](../MASTERPLAN.md) and [baseline evidence](../verification/2026-09-20-baseline.md). They complete the interrupted Claude session and can be executed by Opus or another coding agent without depending on that session's memory.

| Plan | Main responsibility | Prerequisite |
|---|---|---|
| [P0 — Cloudflare foundation and migration](2026-09-20-plan0-reactivate.md) | Workers/D1 auth, API and data migration; staging parity; toolchain/build identity | None |
| [P1 — PWA hardening](2026-09-20-plan1-pwa-hardening.md) | Install metadata, static shell, updates, security headers | P0 |
| [P2 — Device ergonomics](2026-09-20-plan2-device-ergonomics.md) | Phone/tablet navigation, accessible workflows, recipe correctness | P0; integrate P1 changes |
| [P3 — Browser checks](2026-09-20-plan3-browser-checks.md) | Deterministic browser suite and physical-device evidence | P1/P2; begin baseline harness in P0 |
| [P4 — Native shells](2026-09-20-plan4-native-shells.md) | Capacitor/Tauri reproducibility and release preparation | P3; optional parallel track |
| [P5 — Offline resilience](2026-09-20-plan5-offline-resilience.md) | Scoped snapshots, sync recovery and staged safe writes | P0/P1/P3 |
| [P6 — Estate integration](2026-09-20-plan6-estate-integration.md) | Hub/infra integration, monitoring, live verification and handoff | P0–P3/P5; P4 only for native release |

Execution order is **P0 → P1 → P2 → P3 → P5 → P6**, with P4 after P3 when native distribution is wanted. Phase numbers preserve the recovered Claude outline; they do not force native packaging ahead of offline usefulness. Version targets are assigned from actual release scope, not preallocated merely because a document exists.

## Execution contract

1. Read `AGENTS.md` and the bundled Next 16 guides relevant to any framework change. Recheck the repository status, current commit and existing user edits. Use an isolated branch/worktree as appropriate. Do not discard unrelated edits.
2. Verify the stated defect before implementing. If current code contradicts the plan, record the evidence and adjust the task rather than applying an obsolete patch. Existing file targets are starting points; label any new files in the implementation.
3. Keep the static export, household isolation, and AinaDara visual language. The owner explicitly chose Cloudflare: final runtime must not depend on Supabase. Use the smallest justified change. Record an ADR for substantial architecture, persistence, or dependency choices.
4. Add a meaningful regression for observable behavior. Docs/cosmetic changes do not need tests that merely mirror prose. Run focused checks as you work and the phase's full gates once the phase is ready; repeat when changes or failures warrant it.
5. Keep secrets out of source, exported assets, logs, screenshots and test fixtures. Workers secrets and private R2 objects never belong in the browser. Every household API must enforce server authorization; D1 does not inherit PostgreSQL RLS.
6. Verify auth/shared updates/SQL against two synthetic households. Browser fixtures test the frontend; they do not prove Worker authorization, D1 atomicity or deployed service behavior.
7. Use small, reviewable commits. Update the masterplan ledger, relevant runbook and changelog with implementation evidence. A planned checkbox stays unchecked until its criterion is met.
8. Present a reviewable phase diff/PR with what changed, why, checks, and remaining gates. Apply the user's current authorization to merges/deployment; this planning package itself is not authorization to publish or alter accounts.
9. Continue independent work when a credential/device/account is unavailable. Identify the specific missing gate. Do not count unavailable hardware, signing or live integration as passed.
10. After an authorized release, check the actual serving commit/assets and behavior, then record rollback and device evidence. A successful build/deploy command alone is insufficient.

## Ready-to-use execution prompt

```text
Execute docs/plans/2026-09-20-plan0-reactivate.md in pantry-pal.
Read AGENTS.md, docs/MASTERPLAN.md, docs/plans/README.md and the plan first.
Revalidate the baseline and any user edits. Implement this phase's tasks in
dependency order, with scoped regressions and the documented exit gates.
Read the installed Next.js guides before framework changes. Preserve static
export and Workers-enforced household isolation. Record evidence and any plan correction.
Update MASTERPLAN, the relevant runbooks and CHANGELOG in the same work.
Finish with a reviewable diff or PR and exact passed/blocked gates. Continue
independent preparation if a live environment or device is unavailable.
Do not claim deployment or device validation without having verified it.
```

Replace the filename for a later phase; read its prerequisites first. An executor can delegate disjoint implementation/review tasks where useful, but must review their integration and run the phase gates on the resulting branch.

## Independent review prompt

```text
Review the completed Pantry Pal phase against docs/MASTERPLAN.md and its plan.
Inspect the diff and current behavior independently. Focus on static-export
compatibility, cross-household isolation, SW upgrades/offline failure, auth
resume, touch/keyboard paths, and deployment identity where relevant.
For each actionable issue give file/line, trigger, consequence, evidence,
proposed correction and a regression check. Distinguish verified defects from
unproven risks and out-of-scope improvements. Integrate accepted issues by
dependency; record accept/change/reject/duplicate with rationale.
```

## Phase completion record

Append a concise record to the phase or `docs/verification/`: commit; files/behavior changed; commands and results; synthetic integration environment; devices/OS/browser/installed mode; deployment identity; known limits; rollback; next phase. Preserve test artifacts without credentials or household content.
