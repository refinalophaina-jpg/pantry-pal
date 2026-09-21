# ADR 0001 — Cloudflare replaces Supabase

**Status:** accepted; implemented in release 0.10.0. **Date:** 2026-09-20. **Decision maker:** owner, during reactivation planning.

## Decision

Use Cloudflare for Pantry Pal's hosting and backend. Retain Next.js static export and the shared web/native frontend. Target Workers Static Assets + a Workers API, D1 relational storage, authenticated household access, private R2 where files need storage, scheduled catalog work, and optional Durable Objects for shared-update notifications. The final application has no Supabase runtime dependency.

Use a maintained Workers-compatible application authentication library with a proven D1 integration; Better Auth is the starting candidate for P0's compatibility spike. The exact pinned configuration, sign-in/recovery method and native handoff need a small follow-up ADR/test record. Domain ownership is not itself account authentication. Cloudflare Access is an alternative only if the product is intentionally limited to an allowlisted household.

## Consequences

- PostgreSQL RLS, triggers/functions, auth integration and Realtime do not transfer automatically to D1. Workers must enforce session and membership authorization on every operation, and tests must prove cross-household isolation.
- Preserve current user/household data through inventory, private export, schema/identity mapping, rehearsal and reconciliation. Old sessions are not migrated. Keep one write authority and explicit rollback boundaries.
- Build and verify in isolated staging. P0 prepares full backend parity; P6 performs an authorized live domain/data cutover after web/offline gates.
- Do not delete the source backend/data or weaken access checks as a shortcut. Recover source-only functionality or explicitly record the feature gap.
- Native store distribution remains optional; PWA work proceeds first. Cloudflare charges, third-party identity/email needs and AI suitability are measured/configured choices, not implied by the domain being there.

See [masterplan](../MASTERPLAN.md) and [P0](../plans/2026-09-20-plan0-reactivate.md) for implementation and acceptance criteria.

Implementation details and guest access are recorded in [ADR 0002](0002-cloudflare-release.md).
