# ADR 0002 — Cloudflare application and guest recovery

**Status:** implemented for 0.10.0. **Date:** 2026-09-21 UTC.

## Application boundary

Keep the Next.js 16 static export and serve it with Workers Static Assets. The
Worker handles same-origin `/api/*`; no Next server adapter is required. D1 is
the single write authority. Every household route verifies its current session
and membership; atomic operations use D1 batches and an idempotency ledger.
Polling refreshes shared state and reconciles after reconnect. Supabase libraries,
browser keys and scheduled jobs are removed from the active application.

The owner confirmed that no existing accounts or pantry data need preservation.
Staging and production therefore receive separate fresh D1 databases, reference
seeds and auth secrets. Historical Supabase SQL and the old Pages deployment are
retained as references, not active backends.

## Accounts and guests

Better Auth 1.7.5 owns password hashing, sessions, email verification and password
reset. Sessions use seven-day renewable HttpOnly cookies, Secure in deployed
environments, SameSite Lax, and no cross-subdomain sharing. Client JSON excludes
session tokens. Registered users must verify their email. Cloudflare Email Service
sends verification/reset messages from `accounts@pantry.ainadara.com`; its sender
DNS is configured on that dedicated subdomain. Library/provider logs omit request
details, token-bearing paths and email contents.

Guests use Better Auth's anonymous plugin. Their household data is in D1 and their
browser remembers the session cookie. Optional recovery codes contain 256 random
bits; only a SHA-256 digest is stored. Recovery preserves identity and household,
atomically replaces the code, and revokes earlier sessions. The replacement must
be acknowledged before redirect. Codes never enter URLs or browser storage.
Creating another account does not implicitly transfer a guest's household.

Loss of both the cookie and recovery code cannot be recovered. This is presented
in the UI. The optional 24-hour IndexedDB shopping copy is a separate, explicitly
enabled, read-only offline snapshot; clearing or signing out invalidates it across
tabs. Full offline editing is outside this release.

## Providers and delivery

Workers AI supplies photo suggestions and meal-plan selection with schema and
membership validation and per-user rate limits. Photos are transient and require
no R2 bucket. Default recipe discovery uses bundled/D1 recipes without a provider
secret. Optional world-recipe lookup retains TheMealDB and gracefully falls back.
Review its production distribution terms before a public native-store release.

Production uses the exact-host route `pantry.ainadara.com/*` over the retained
proxied Pages CNAME. The Worker answers static and API requests itself. The route
keeps the initial cutover reversible without deleting the Pages association;
after D1 receives user writes, rollback must preserve D1 as authority. Prefer a
compatible previous Worker or maintenance mode, not exposing the old app again.

Hourly catalog jobs have bounded batches, a fenced lease, retries and recorded
status. Local/CI tests do not prove a production scheduled invocation occurred.
See [deployment procedure](../../DEPLOY.md) and the release verification record
for observed evidence and remaining device checks.
