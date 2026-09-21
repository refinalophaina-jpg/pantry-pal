<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Current reactivation work

Read `docs/MASTERPLAN.md` and `docs/plans/README.md` before implementing a phase.
The owner chose **Cloudflare instead of Supabase**: Workers API + D1, retaining
the Next.js static export. Existing Supabase code is migration input, not the
target architecture. Preserve existing data, verify server-side household
authorization, and follow the staged migration/cutover gates. The plans are not
implemented merely because their documents exist. Update the masterplan ledger
with measured results as work lands.
