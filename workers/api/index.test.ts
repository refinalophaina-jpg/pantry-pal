// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "./index";
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), handleAuth: vi.fn(), handleData: vi.fn(), handleProviders: vi.fn(), refreshCatalog: vi.fn() }));
vi.mock("./auth", () => ({ getSession: mocks.getSession, handleAuth: mocks.handleAuth }));
vi.mock("./data", () => ({ handleData: mocks.handleData }));
vi.mock("./providers", () => ({ handleProviders: mocks.handleProviders }));
vi.mock("./catalog-job", () => ({ refreshCatalog: mocks.refreshCatalog }));
const origin = "https://pantry.test";
const env = { BETTER_AUTH_URL: origin, ASSETS: { fetch: vi.fn().mockResolvedValue(new Response("asset")) }, DB: { prepare: () => ({ first: async () => ({ value: 1 }) }) } } as unknown as Env;
const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;
function request(path: string, options: RequestInit = {}) { return new Request(`${origin}${path}`, options); }

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: "cook", emailVerified: true } });
  mocks.handleData.mockResolvedValue(Response.json({ data: [] }));
  mocks.handleProviders.mockResolvedValue(null);
  mocks.handleAuth.mockResolvedValue(Response.json({ ok: true }));
});

describe("Worker entry security boundary", () => {
  it("rejects unauthenticated and unverified data requests", async () => {
    for (const session of [null, { user: { id: "cook", emailVerified: false } }]) {
      mocks.getSession.mockResolvedValue(session);
      expect((await worker.fetch(request("/api/households"), env, ctx)).status).toBe(401);
    }
    expect(mocks.handleData).not.toHaveBeenCalled();
    expect(mocks.handleProviders).not.toHaveBeenCalled();
  });
  it("rejects cross-origin mutations even when cookies are present", async () => {
    const response = await worker.fetch(request("/api/households", { method: "POST", headers: { Origin: "https://attacker.test", Cookie: "session=present" }, body: "{}" }), env, ctx);
    expect(response.status).toBe(403);
    expect(mocks.getSession).not.toHaveBeenCalled();
  });
  it("allows an explicitly anonymous guest without weakening registered email verification", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "guest", emailVerified: false, isAnonymous: true } });
    expect((await worker.fetch(request("/api/households"), env, ctx)).status).toBe(200);
    expect(mocks.handleData).toHaveBeenCalled();
  });
  it("enforces canonical API host and requires Origin on writes", async () => {
    expect((await worker.fetch(new Request("https://alias.test/api/households"), env, ctx)).status).toBe(403);
    expect((await worker.fetch(request("/api/households", { method: "POST", body: "{}" }), env, ctx)).status).toBe(403);
  });
  it("bounds actual streamed auth and domain body sizes", async () => {
    for (const [path, length] of [["/api/auth/sign-up/email", 16_385], ["/api/households", 131_073]] as const) {
      const response = await worker.fetch(request(path, { method: "POST", headers: { Origin: origin }, body: "x".repeat(length) }), env, ctx);
      expect(response.status).toBe(413);
    }
    expect(mocks.handleAuth).not.toHaveBeenCalled();
    expect(mocks.handleData).not.toHaveBeenCalled();
  });
  it("preserves auth cookies while preventing API caching", async () => {
    mocks.handleAuth.mockResolvedValue(Response.json({ ok: true }, { headers: { "Set-Cookie": "session=test; HttpOnly; Secure; SameSite=Lax" } }));
    const response = await worker.fetch(request("/api/auth/get-session"), env, ctx);
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
  it("does not leak reset tokens into exception logs or API errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.handleAuth.mockRejectedValue(new Error("private-provider-diagnostic"));
      const response = await worker.fetch(request("/api/auth/reset-password/private-reset-token"), env, ctx);
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("private-provider-diagnostic");
      expect(JSON.stringify(log.mock.calls)).not.toContain("private-reset-token");
    } finally { log.mockRestore(); }
  });
});
