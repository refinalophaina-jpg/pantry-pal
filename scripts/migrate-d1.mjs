#!/usr/bin/env node
import { fail, isMain, parseTargetArgs, targetHelp, withD1 } from "./d1-tools.mjs";

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help")) { console.log(`Apply tracked authentication migrations, then domain migrations.\n${targetHelp}`); return; }
  const { target, args } = parseTargetArgs(argv);
  if (args.length) throw new Error(`Unknown argument ${args[0]}.`);
  await withD1(target, async d1 => {
    await d1.migrate("auth");
    await d1.migrate("d1");
    const results = await d1.query("PRAGMA foreign_key_check;");
    if (results.some(result => result.results?.length)) throw new Error("Migration finished with foreign-key violations.");
    console.log("Tracked migrations applied; foreign-key check passed.");
  });
}
if (isMain(import.meta.url)) main().catch(fail);
