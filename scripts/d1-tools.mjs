import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { experimental_readRawConfig } from "wrangler";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const targetHelp = "--env local|staging|production (default local), --local (default) or --remote, --persist-to <local directory>, --config <wrangler.jsonc>";

/** Remote access must name an environment; an omitted flag always stays local. */
export function parseTargetArgs(args) {
  const target = { environment: "local", remote: false, config: join(projectRoot, "wrangler.jsonc"), persistTo: join(projectRoot, ".wrangler/state") };
  const rest = [];
  let scope;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (["--env", "--persist-to", "--config"].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}.`);
      if (arg === "--env") target.environment = value;
      else if (arg === "--persist-to") target.persistTo = resolve(value);
      else target.config = resolve(value);
    } else if (arg === "--local" || arg === "--remote") {
      if (scope && scope !== arg) throw new Error("Choose either --local or --remote.");
      scope = arg;
      target.remote = arg === "--remote";
    } else rest.push(arg);
  }
  if (!["local", "staging", "production"].includes(target.environment)) throw new Error("Environment must be local, staging, or production.");
  if (target.remote && target.environment === "local") throw new Error("--remote requires --env staging or --env production.");
  if (target.remote && args.includes("--persist-to")) throw new Error("--persist-to is only valid with --local.");
  return { target, args: rest };
}

export function selectDatabase(rawConfig, environment) {
  const section = environment === "local" ? rawConfig : rawConfig.env?.[environment];
  if (!section) throw new Error(`Environment ${environment} is not configured; no database was selected.`);
  const database = section.d1_databases?.find(db => db.binding === "DB");
  if (!database?.database_name || !database?.database_id) throw new Error(`Environment ${environment} requires an explicit DB name and ID.`);
  return database;
}

/** Wrangler's remote SQL-file importer prints progress even with --json. */
export function parseWranglerJson(output) {
  const clean = stripVTControlCharacters(output);
  const starts = [...clean.matchAll(/^\s*\[/gm)].map(match => match.index);
  const ends = [...clean.matchAll(/^\s*\]\s*$/gm)].map(match => match.index + match[0].length);
  const candidates = [clean, ...starts.flatMap(start => ends.filter(end => end > start).reverse().map(end => clean.slice(start, end)))];
  for (const candidate of candidates) {
    let result;
    try { result = JSON.parse(candidate); } catch { continue; }
    if (Array.isArray(result)) {
      if (result.some(item => !item || typeof item !== "object" || item.success === false)) throw new Error("D1 returned an unsuccessful SQL result.");
      return result;
    }
  }
  throw new Error("Wrangler did not return a valid D1 JSON result.");
}

async function runWrangler(args, capture = true) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [join(projectRoot, "node_modules/wrangler/bin/wrangler.js"), ...args], {
      cwd: projectRoot,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      // No shell interpolation, and no interactive prompt in this explicit CLI action.
      stdio: ["ignore", capture ? "pipe" : "inherit", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) reject(new Error(`Wrangler failed (${code ?? "signal"}). ${stderr.trim() || stdout.trim()}`));
      else { if (stderr.trim()) console.error(stderr.trim()); resolveRun(stdout); }
    });
  });
}

/** Temporary configs isolate migration directories without rewriting the project config. */
export async function withD1(target, action) {
  const { rawConfig } = experimental_readRawConfig({ config: target.config });
  const database = selectDatabase(rawConfig, target.environment);
  const directory = await mkdtemp(join(tmpdir(), "pantry-d1-"));
  const base = {
    name: "pantry-d1-tools",
    account_id: rawConfig.account_id,
    compatibility_date: rawConfig.compatibility_date,
  };
  const commandConfig = join(directory, "wrangler.json");
  const binding = { binding: "DB", database_name: database.database_name, database_id: database.database_id };
  await writeFile(commandConfig, JSON.stringify({ ...base, d1_databases: [binding] }));
  const scope = target.remote ? ["--remote"] : ["--local", "--persist-to", target.persistTo];
  console.log(`D1 target: ${target.environment} / ${target.remote ? "REMOTE" : "local"} / ${database.database_name}`);
  const executeArgs = ["d1", "execute", database.database_name, "--config", commandConfig, ...scope, "--yes", "--json"];
  try {
    await action({
      async query(sql) {
        return parseWranglerJson(await runWrangler([...executeArgs, "--command", sql]));
      },
      async execute(sql) {
        const file = join(directory, `${crypto.randomUUID()}.sql`);
        await writeFile(file, sql, { mode: 0o600 });
        return parseWranglerJson(await runWrangler([...executeArgs, "--file", file]));
      },
      async migrate(kind) {
        if (!["auth", "d1"].includes(kind)) throw new Error("Unknown migration group.");
        const config = join(directory, `wrangler-${kind}.json`);
        const table = kind === "auth" ? "d1_auth_migrations" : database.migrations_table ?? "d1_migrations";
        await writeFile(config, JSON.stringify({ ...base, d1_databases: [{ ...binding, migrations_dir: join(projectRoot, "migrations", kind), migrations_table: table }] }));
        await runWrangler(["d1", "migrations", "apply", database.database_name, "--config", config, ...scope], false);
      },
    });
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && !value.includes("\0")) return `'${value.replaceAll("'", "''")}'`;
  throw new Error("Invalid SQL value.");
}

const columns = {
  foods: ["barcode", "name", "brand", "category", "serving_size", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "source", "source_id"],
  ingredients: ["slug", "name", "category", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "source", "source_id"],
};

export function upsertSql(table, row) {
  if (!Object.hasOwn(columns, table)) throw new Error("Unknown catalog table.");
  const fields = columns[table];
  const key = table === "foods" ? "barcode" : "slug";
  if (!row[key] || !row.name) throw new Error(`Catalog row requires ${key} and name.`);
  for (const field of Object.keys(row)) if (!fields.includes(field)) throw new Error(`Unknown catalog field ${field}.`);
  const assignments = fields.filter(field => field !== key).map(field => `${field}=excluded.${field}`);
  return `INSERT INTO ${table}(id,${fields.join(",")}) VALUES(${sqlValue(crypto.randomUUID())},${fields.map(field => sqlValue(row[field])).join(",")}) ON CONFLICT(${key}) DO UPDATE SET ${assignments.join(",")},updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now');`;
}

export async function upsertRows(d1, table, rows) {
  // Validate every row before starting the first write. A failed batch exits;
  // already committed batches can be safely retried using each table's unique key.
  const statements = rows.map(row => upsertSql(table, row));
  for (let start = 0; start < statements.length; start += 50) {
    await d1.execute(statements.slice(start, start + 50).join("\n"));
    console.log(`Saved ${Math.min(start + 50, statements.length)}/${statements.length} ${table}.`);
  }
}

export async function fetchJson(url, init = {}, fetchImpl = fetch) {
  let response;
  try { response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(30_000), redirect: "error" }); }
  catch { throw new Error(`Provider request failed (${new URL(url).hostname}); no further writes attempted.`); }
  if (!response.ok) throw new Error(`Provider HTTP ${response.status} (${new URL(url).hostname}).`);
  try { return await response.json(); }
  catch { throw new Error(`Provider returned invalid JSON (${new URL(url).hostname}).`); }
}

export function isMain(metaUrl) { return Boolean(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === metaUrl); }
export function fail(error) { console.error(error instanceof Error ? error.message : "Import failed."); process.exitCode = 1; }
