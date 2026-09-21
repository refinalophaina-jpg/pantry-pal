// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { handleProviders } from "./providers";

let mf: Miniflare;
let env: Env;
const ai = vi.fn();
const body = { householdId: "house-a", dates: ["2026-09-21"], meals: ["dinner"], candidates: [{ id: "rice", name: "Rice bowl" }] };
function request() { return new Request("https://pantry.test/api/meal-plan/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }

beforeAll(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: "export default {fetch(){return new Response('test')}}", d1Databases: ["DB"], compatibilityDate: "2026-09-20" }));
  env = await mf.getBindings<Env>();
  for (const file of ["migrations/auth/0001_better_auth.sql", "migrations/d1/0001_domain.sql"]) await env.DB.exec(readFileSync(file, "utf8").replace(/^--.*$/gm, "").replace(/\n/g, " "));
  for (const name of ["a", "b"]) {
    await env.DB.prepare('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,?,?)').bind(`user-${name}`, name, `${name}@example.test`, new Date().toISOString(), new Date().toISOString()).run();
    await env.DB.prepare("INSERT INTO households(id,name,created_by) VALUES(?,?,?)").bind(`house-${name}`, `House ${name}`, `user-${name}`).run();
    await env.DB.prepare("INSERT INTO household_members(household_id,user_id,role) VALUES(?,?,'owner')").bind(`house-${name}`, `user-${name}`).run();
    await env.DB.prepare("INSERT INTO pantry_items(id,household_id,name,quantity,unit,expires_on) VALUES(?,?,?,1,'pcs','2026-09-23')").bind(`food-${name}`, `house-${name}`, `Private food ${name}`).run();
  }
  env.AI = { run: ai } as unknown as Env["AI"];
  env.PROVIDER_LIMITER = { limit: async () => ({ success: true }) } as unknown as Env["PROVIDER_LIMITER"];
});
afterAll(async () => { await mf?.dispose(); });
beforeEach(() => { ai.mockReset().mockResolvedValue({ response: JSON.stringify({ entries: [{ date: "2026-09-21", meal: "dinner", recipeId: "rice" }] }) }); });

describe("Meal planning with the actual D1 schema", () => {
  it("reads the real expires_on column and sends only the authorized household's pantry", async () => {
    const response = await handleProviders(request(), env, { id: "user-a" });
    expect(response!.status).toBe(200);
    const prompt = JSON.parse(ai.mock.calls[0][1].messages[1].content);
    expect(prompt.pantry).toEqual([{ name: "Private food a", expires_on: "2026-09-23" }]);
    expect(JSON.stringify(prompt)).not.toContain("Private food b");
  });
  it("does not send another household's pantry to AI", async () => {
    await expect(handleProviders(request(), env, { id: "user-b" })).rejects.toMatchObject({ status: 403 });
    expect(ai).not.toHaveBeenCalled();
  });
});
