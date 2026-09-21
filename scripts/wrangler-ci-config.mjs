#!/usr/bin/env node
// Writes wrangler.ci.json: the local configuration with every binding that needs a
// Cloudflare login removed. `wrangler dev` proxies the Workers AI binding to the edge
// even in local mode, so in a non-interactive runner without CLOUDFLARE_API_TOKEN it
// refuses to start at all — and the browser journeys never call AI. D1, email and
// rate limits stay, so the suite still runs against the real local D1 state.
import { writeFileSync } from "node:fs";
import { experimental_readRawConfig } from "wrangler";
import { projectRoot } from "./d1-tools.mjs";
import { join } from "node:path";

const { rawConfig } = experimental_readRawConfig({ config: join(projectRoot, "wrangler.jsonc") });
const { env: _envs, ai: _ai, $schema: _schema, ...local } = rawConfig;
const out = join(projectRoot, "wrangler.ci.json");
writeFileSync(out, JSON.stringify({ ...local, name: "pantry-pal-ci" }, null, 2) + "\n");
console.log(`Wrote ${out}: bindings ${Object.keys(local).filter(k => ["d1_databases", "send_email", "ratelimits", "assets"].includes(k)).join(", ")}; ai and env sections removed.`);
