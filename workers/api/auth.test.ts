// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { createAuth, getSession, handleAuth } from "./auth";

type AuthEnv = Parameters<typeof createAuth>[1];
const origin = "https://pantry.test";
const email = "cook@example.test";
const password = "correct horse battery staple";
let mf: Miniflare;
let env: AuthEnv;
const mail = vi.fn().mockResolvedValue({ messageId: "mock-message" });

function request(path: string, body?: unknown, cookie?: string, requestOrigin: string | null = origin) {
  const headers = new Headers({ "cf-connecting-ip": "203.0.113.2" });
  if (requestOrigin) headers.set("Origin", requestOrigin);
  if (cookie) headers.set("Cookie", cookie);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  return new Request(`${origin}/api/auth/${path}`, { method: body === undefined ? "GET" : "POST", headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function cookies(response: Response) { return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; "); }
function lastMailLink() { return mail.mock.calls.at(-1)![0].text.match(/https:\/\/\S+/)[0] as string; }
async function verifiedAccount() {
  const signup = await handleAuth(request("sign-up/email", { name: "Cook", email, password, callbackURL: "/sign-in/" }), env);
  expect(signup.status).toBe(200);
  const verification = await handleAuth(new Request(lastMailLink()), env);
  expect(verification.status).toBe(302);
  const signin = await handleAuth(request("sign-in/email", { email, password }), env);
  expect(signin.status).toBe(200);
  return { cookie: cookies(signin), signin };
}

beforeAll(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: "export default {fetch(){return new Response('test')}}", d1Databases: ["DB"], compatibilityDate: "2026-09-20" }));
  const db = await mf.getD1Database("DB");
  for (const file of ["0001_better_auth.sql", "0002_guest_recovery.sql"]) {
    const sql = (await readFile(new URL(`../../migrations/auth/${file}`, import.meta.url), "utf8")).replace(/^--.*$/gm, "");
    for (const statement of sql.split(";").map((value) => value.trim()).filter(Boolean)) await db.prepare(statement).run();
  }
  env = {
    DB: db as unknown as AuthEnv["DB"],
    BETTER_AUTH_SECRET: "local-test-secret-at-least-thirty-two-characters-long",
    BETTER_AUTH_URL: origin,
    AUTH_EMAIL_FROM: "pantry@example.test",
    AUTH_EMAIL_ENABLED: "true",
    EMAIL: { send: mail } as unknown as AuthEnv["EMAIL"],
  } as AuthEnv;
});
afterAll(async () => { await mf?.dispose(); });
beforeEach(async () => {
  mail.mockClear();
  for (const table of ["session", "account", "verification", "user", "rateLimit"]) await env.DB.prepare(`DELETE FROM "${table}"`).run();
});

describe("Better Auth on D1", () => {
  it("requires verification, uses secure cookies, and revokes sessions on signout", async () => {
    const signup = await handleAuth(request("sign-up/email", { name: "Cook", email, password, callbackURL: "/sign-in/" }), env);
    expect(signup.status).toBe(200);
    expect((await signup.json() as { token?: unknown }).token).toBeUndefined();
    expect(mail).toHaveBeenCalledOnce();
    expect(mail.mock.calls[0][0].from).toEqual({ email: env.AUTH_EMAIL_FROM, name: "Pantry Pal" });
    const unverified = await handleAuth(request("sign-in/email", { email, password }), env);
    expect(unverified.status).toBe(403);
    expect(await unverified.json()).toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
    await handleAuth(new Request(lastMailLink()), env);
    const signin = await handleAuth(request("sign-in/email", { email, password }), env);
    expect(signin.status).toBe(200);
    expect(signin.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(signin.headers.get("set-cookie")).toMatch(/Secure/i);
    expect(signin.headers.get("set-cookie")).toMatch(/SameSite=Lax/i);
    const cookie = cookies(signin);
    expect((await getSession(request("get-session", undefined, cookie), env))?.user.email).toBe(email);
    const signout = await handleAuth(request("sign-out", {}, cookie), env);
    expect(signout.status).toBe(200);
    expect(await getSession(request("get-session", undefined, cookie), env)).toBeNull();
  });

  it("resets passwords once and immediately revokes old sessions", async () => {
    const { cookie } = await verifiedAccount();
    const reset = await handleAuth(request("request-password-reset", { email, redirectTo: `${origin}/sign-in/` }), env);
    expect(reset.status).toBe(200);
    const redirect = await handleAuth(new Request(lastMailLink()), env);
    expect(redirect.status).toBe(302);
    const token = new URL(redirect.headers.get("location")!).searchParams.get("token");
    expect(token).toBeTruthy();
    const changed = await handleAuth(request("reset-password", { token, newPassword: "another long password" }), env);
    expect(changed.status).toBe(200);
    expect(await getSession(request("get-session", undefined, cookie), env)).toBeNull();
    expect((await handleAuth(request("reset-password", { token, newPassword: "replayed long password" }), env)).status).toBe(400);
    expect((await handleAuth(request("sign-in/email", { email, password }), env)).status).toBe(401);
    expect((await handleAuth(request("sign-in/email", { email, password: "another long password" }), env)).status).toBe(200);
  });

  it("cannot bypass registered email verification by supplying anonymous or verified flags", async () => {
    const response = await handleAuth(request("sign-up/email", { name: "Cook", email, password, isAnonymous: true, emailVerified: true }), env);
    expect(response.status).toBe(200);
    const user = await env.DB.prepare('SELECT "isAnonymous", "emailVerified" FROM "user" WHERE email=?').bind(email).first();
    expect(user).toEqual({ isAnonymous: 0, emailVerified: 0 });
    const signin = await handleAuth(request("sign-in/email", { email, password, isAnonymous: true }), env);
    expect(signin.status).toBe(403);
    expect(await signin.json()).toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
  });

  it("rejects cross-origin and missing-origin mutations before creating an account", async () => {
    for (const suppliedOrigin of ["https://attacker.test", null]) {
      const response = await handleAuth(request("sign-up/email", { name: "Cook", email, password }, undefined, suppliedOrigin), env);
      expect(response.status).toBe(403);
    }
    expect(await env.DB.prepare('SELECT count(*) AS count FROM "user"').first("count")).toBe(0);
    expect(mail).not.toHaveBeenCalled();
  });

  it("rejects callback URLs outside the canonical application origin", async () => {
    const response = await handleAuth(request("sign-up/email", { name: "Cook", email, password, callbackURL: "https://attacker.test/" }), env);
    expect(response.status).toBe(403);
    expect(mail).not.toHaveBeenCalled();
  });

  it("fails enrollment and recovery closed when email is not configured", async () => {
    for (const unavailable of [{ ...env, AUTH_EMAIL_FROM: "" }, { ...env, AUTH_EMAIL_ENABLED: "false" }, { ...env, EMAIL: undefined }] as AuthEnv[]) {
      for (const path of ["sign-up/email", "request-password-reset", "send-verification-email"]) {
        const response = await handleAuth(request(path, { name: "Cook", email, password }), unavailable);
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ code: "AUTH_EMAIL_UNAVAILABLE" });
      }
    }
    expect(await env.DB.prepare('SELECT count(*) AS count FROM "user"').first("count")).toBe(0);
  });

  it("keeps account lookup private on password recovery", async () => {
    const { cookie } = await verifiedAccount();
    const existing = await handleAuth(request("request-password-reset", { email, redirectTo: `${origin}/sign-in/` }, cookie), env);
    const missing = await handleAuth(request("request-password-reset", { email: "missing@example.test", redirectTo: `${origin}/sign-in/` }), env);
    expect(existing.status).toBe(missing.status);
    expect(await existing.json()).toEqual(await missing.json());
  });

  it("enforces shared D1 rate limits across independent auth instances", async () => {
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      const response = await handleAuth(request("request-password-reset", { email: "missing@example.test", redirectTo: `${origin}/sign-in/` }), env);
      statuses.push(response.status);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it("discards credential-bearing library error messages and exception details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const context = await createAuth(request("get-session"), env).$context;
      context.logger.error("private-recovery-code", { token: "private-session-token", recipient: "private@example.test" });
      context.logger.warn("private-warning", new Error("private-adapter-bindings"));
      expect(log.mock.calls).toEqual([
        [JSON.stringify({ event: "auth_library_event", level: "error" })],
        [JSON.stringify({ event: "auth_library_event", level: "warn" })],
      ]);
    } finally { log.mockRestore(); }
  });
});
