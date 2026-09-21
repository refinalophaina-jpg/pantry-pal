// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { getSession, handleAuth } from "./auth";
import { handleData } from "./data";
let mf: Miniflare;
let env: Env;
const origin = "https://pantry.test";
const email = vi.fn();
function request(path: string, body?: unknown, cookie?: string, ip = "203.0.113.50") {
  return new Request(`${origin}/api/auth/${path}`, { method: body === undefined ? "GET" : "POST", headers: { Origin: origin, "Content-Type": "application/json", "cf-connecting-ip": ip, ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const cookies = (response: Response) => response.headers.getSetCookie().map(cookie => cookie.split(";")[0]).join("; ");
async function start() {
  const response = await handleAuth(request("sign-in/anonymous", {}), env);
  expect(response.status).toBe(200);
  const body = await response.json() as { user: { id: string; isAnonymous: boolean }; token?: string };
  return { response, body, cookie: cookies(response) };
}
async function rotate(cookie: string) {
  const response = await handleAuth(request("guest/recovery-code", {}, cookie), env);
  expect(response.status).toBe(200);
  return (await response.json() as { recoveryCode: string }).recoveryCode;
}
beforeAll(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: "export default {fetch(){return new Response('test')}}", d1Databases: ["DB"], compatibilityDate: "2026-09-20" }));
  env = await mf.getBindings<Env>();
  for (const file of ["migrations/auth/0001_better_auth.sql", "migrations/auth/0002_guest_recovery.sql", "migrations/d1/0001_domain.sql"]) await env.DB.exec(readFileSync(file, "utf8").replace(/^--.*$/gm, "").replace(/\n/g, " "));
  Object.assign(env, { BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: "test-guest-secret-at-least-thirty-two-random-characters", AUTH_EMAIL_ENABLED: "false", AUTH_EMAIL_FROM: "", EMAIL: { send: email } });
});
afterAll(async () => { await mf?.dispose(); });
beforeEach(async () => {
  email.mockClear();
  // Keep household fixtures intact across cases; per-case users and hashes are fresh.
  await env.DB.prepare('DELETE FROM "rateLimit"').run();
});

describe("Guest identity and recovery on D1", () => {
  it("starts without email and returns only a secure remembered cookie, never session tokens", async () => {
    const guest = await start();
    expect(guest.body.user.isAnonymous).toBe(true);
    expect(guest.body.token).toBeUndefined();
    expect(guest.response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(guest.response.headers.get("set-cookie")).toMatch(/Max-Age=604800/i);
    const response = await handleAuth(request("get-session", undefined, guest.cookie), env);
    const session = await response.json() as { session: { token?: string }; user: { id: string; emailVerified: boolean } };
    expect(session.session.token).toBeUndefined();
    expect(session.user.id).toBe(guest.body.user.id);
    expect(session.user.emailVerified).toBe(false);
    expect(email).not.toHaveBeenCalled();
  });

  it("stores only a recovery digest and restores the same household in a new browser", async () => {
    const guest = await start();
    const code = await rotate(guest.cookie);
    expect(code).toMatch(/^PPG-(?:[0-9a-f]{8}-){7}[0-9a-f]{8}$/);
    const row = await env.DB.prepare("SELECT * FROM guest_recovery WHERE user_id=?").bind(guest.body.user.id).first();
    expect(JSON.stringify(row)).not.toContain(code);
    expect(row?.secret_hash).toMatch(/^[0-9a-f]{64}$/);
    const created = await handleData(new Request(`${origin}/api/households`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Recovered guest kitchen" }) }), env, guest.body.user);
    expect(created!.status).toBe(201);
    const response = await handleAuth(request("guest/recover", { code }), env);
    expect(response.status).toBe(200);
    const result = await response.json() as { recoveryCode: string; token?: string };
    expect(result.recoveryCode).not.toBe(code);
    expect(result.token).toBeUndefined();
    const recovered = await getSession(request("get-session", undefined, cookies(response)), env);
    expect(recovered?.user.id).toBe(guest.body.user.id);
    const homes = await handleData(new Request(`${origin}/api/households`), env, recovered!.user);
    expect(await homes!.json()).toMatchObject({ data: [{ name: "Recovered guest kitchen" }] });
    expect(await getSession(request("get-session", undefined, guest.cookie), env)).toBeNull();
    expect((await handleAuth(request("guest/recover", { code }), env)).status).toBe(401);
  });

  it("rotation revokes the previous code and guests cannot access each other's homes", async () => {
    const owner = await start();
    const oldCode = await rotate(owner.cookie);
    const newCode = await rotate(owner.cookie);
    expect((await handleAuth(request("guest/recover", { code: oldCode }), env)).status).toBe(401);
    expect((await handleAuth(request("guest/recover", { code: newCode }), env)).status).toBe(200);
    const other = await start();
    const home = await handleData(new Request(`${origin}/api/households`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Private guest home" }) }), env, owner.body.user);
    const id = (await home!.json() as { data: { id: string } }).data.id;
    expect((await handleData(new Request(`${origin}/api/households/${id}/snapshot`), env, other.body.user))!.status).toBe(403);
  });

  it("only one concurrent recovery can claim a code", async () => {
    const guest = await start();
    const code = await rotate(guest.cookie);
    const responses = await Promise.all([handleAuth(request("guest/recover", { code }), env), handleAuth(request("guest/recover", { code }), env)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 401]);
    const winner = responses.find(response => response.status === 200)!;
    expect((await getSession(request("get-session", undefined, cookies(winner)), env))?.user.id).toBe(guest.body.user.id);
  });

  it("cannot recover a registered account or create a code without a guest session", async () => {
    expect((await handleAuth(request("guest/recovery-code", {}), env)).status).toBe(401);
    const guest = await start();
    const code = await rotate(guest.cookie);
    await env.DB.prepare('UPDATE "user" SET "isAnonymous"=0 WHERE id=?').bind(guest.body.user.id).run();
    expect((await handleAuth(request("guest/recovery-code", {}, guest.cookie), env)).status).toBe(403);
    expect((await handleAuth(request("guest/recover", { code }), env)).status).toBe(401);
  });

  it("cannot rotate a code if its session is revoked after the middleware check", async () => {
    const guest = await start();
    const code = await rotate(guest.cookie);
    const prepare = env.DB.prepare.bind(env.DB);
    let revoked = false;
    const db = new Proxy(env.DB, { get(target, key) {
      if (key !== "prepare") {
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      }
      return (sql: string) => {
        const statement = prepare(sql);
        if (!sql.startsWith("INSERT INTO guest_recovery")) return statement;
        return { bind: (...values: unknown[]) => {
          const bound = statement.bind(...values);
          return { first: async () => {
            await prepare('DELETE FROM "session" WHERE "userId"=?').bind(guest.body.user.id).run();
            revoked = true;
            return bound.first();
          } };
        } };
      };
    } });
    expect((await handleAuth(request("guest/recovery-code", {}, guest.cookie), { ...env, DB: db })).status).toBe(403);
    expect(revoked).toBe(true);
    expect((await handleAuth(request("guest/recover", { code }), env)).status).toBe(200);
  });

  it("uses generic recovery failures and persistent rate limiting", async () => {
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const response = await handleAuth(request("guest/recover", { code: `PPG-${String(i).repeat(64)}` }), env);
      statuses.push(response.status);
      if (i < 5) expect(await response.json()).toMatchObject({ code: "INVALID_RECOVERY_CODE" });
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    const starts = [];
    for (let i = 0; i < 6; i++) starts.push((await handleAuth(request("sign-in/anonymous", {}), env)).status);
    expect(starts).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("rejects cross-origin recovery and guest creation before reading the credential", async () => {
    for (const path of ["sign-in/anonymous", "guest/recover", "guest/recovery-code"]) {
      const response = await handleAuth(new Request(`${origin}/api/auth/${path}`, { method: "POST", headers: { Origin: "https://attacker.test", "Content-Type": "application/json" }, body: JSON.stringify({ code: "private-code" }) }), env);
      expect(response.status).toBe(403);
    }
  });
});
