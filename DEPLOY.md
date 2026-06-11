# Deploying Pantry Pal

The app is a Next.js static export — every page builds to a plain HTML file. Anything dynamic (auth, data) happens against Supabase from the browser. So any static host works; this guide assumes Cloudflare Pages.

## Option A — Cloudflare Pages GitHub integration (recommended)

This is the no-CLI path. Once set up, every push to `main` auto-deploys.

1. Sign in to https://dash.cloudflare.com/ and open **Workers & Pages → Create → Pages → Connect to Git**.
2. Authorize the GitHub app and select `refinalophaina-jpg/pantry-pal`.
3. **Build settings:**
   - Framework preset: **Next.js (Static HTML Export)**
   - Build command: `npm run build`
   - Build output directory: `out`
   - Root directory: leave blank
4. **Environment variables** (Build → set for *both* Production and Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://ctmwamavavluowgmbcma.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_Ot5ZwJz0rTLFnmrC-Gw5Jw_a5fUlNih`
5. Click **Save and Deploy**. First build takes ~2 min.
6. After deploy, copy your `*.pages.dev` URL and add it to Supabase as an allowed redirect:
   - Supabase dashboard → Authentication → URL Configuration → **Site URL** = your `*.pages.dev` URL
   - Add the same URL to **Redirect URLs**

## Custom domain — pantry.ainadara.com

`ainadara.com` is already a Cloudflare zone (same account as the Pages
project), so attaching the subdomain is two steps, no DNS records to write by
hand:

1. **Cloudflare:** dash.cloudflare.com → **Workers & Pages → pantry-pal →
   Custom domains → Set up a custom domain** → enter `pantry.ainadara.com`.
   Because the zone lives in the same account, Cloudflare creates and
   activates the CNAME for you (usually under a minute).
2. **Supabase:** dashboard → Authentication → **URL Configuration** → add
   `https://pantry.ainadara.com` to **Redirect URLs** (and switch **Site URL**
   to it if you want it to be the canonical origin). Without this, sign-in
   links and OAuth redirects from the new domain are rejected.

Nothing in the app itself needs to change — the build is origin-agnostic
(relative manifest `start_url`, no hardcoded URLs), and `*.pages.dev` keeps
working alongside the subdomain.

## Option B — GitHub Actions (optional)

If you want CI-driven deploys instead of the dashboard integration, this repo can run a `cloudflare/wrangler-action` workflow. It's not committed yet because the current token lacks the `workflow` scope. To enable:

```bash
gh auth refresh -s workflow
# then ask Claude to add .github/workflows/deploy.yml back
```

Then set repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Option A is simpler — only use Option B if you specifically want CI control.

## Local dev

```bash
cp .env.example .env.local   # fill in the same Supabase URL/key
npm install
npm run dev
```

App on http://localhost:3000.

## Schema changes

Add a new file under `supabase/migrations/<timestamp>_<name>.sql`. The Supabase ↔ GitHub integration auto-applies on push to `main`. To preview locally first, use the Supabase CLI: `supabase db push`.
