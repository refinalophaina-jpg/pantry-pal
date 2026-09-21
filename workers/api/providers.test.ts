// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleProviders } from "./providers";
import { ApiError } from "./domain-validation";
const mocks = vi.hoisted(() => ({ member: vi.fn(), ai: vi.fn(), limit: vi.fn(), fetch: vi.fn() }));
vi.mock("./domain-repository", async (original) => ({ ...await original<typeof import("./domain-repository")>(), requireMember: mocks.member }));
const env = { AI: { run: mocks.ai }, PROVIDER_LIMITER: { limit: mocks.limit }, DB: { prepare: () => ({ bind: () => ({}) }), batch: async () => [{ results: [{ role: 'owner' }] }, { results: [] }] } } as unknown as Env;
const user = { id: "user-a" };
function request(path: string, body: unknown) { return new Request(`https://pantry.test/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
const plan = { householdId: "house-a", dates: ["2026-09-21"], meals: ["dinner"], candidates: [{ id: "recipe-a", name: "Beans", minutes: 20 }] };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({ role: "owner" });
  mocks.limit.mockResolvedValue({ success: true });
  mocks.ai.mockResolvedValue({ response: JSON.stringify({ entries: [{ date: "2026-09-21", meal: "dinner", recipeId: "recipe-a" }] }) });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("Provider boundaries", () => {
  it("accepts the parsed object returned by Workers AI JSON mode", async () => {
    const entries = [{ date: "2026-09-21", meal: "dinner", recipeId: "recipe-a" }];
    mocks.ai.mockResolvedValue({ response: { entries } });
    const response = await handleProviders(request("meal-plan/generate", plan), env, user);
    expect(await response!.json()).toEqual({ entries });
  });
  it("checks household membership before sending photos or pantry data to AI", async () => {
    mocks.member.mockRejectedValue(new ApiError(403, "household_forbidden", "No access"));
    for (const [path, body] of [["pantry/recognize", { householdId: "other-house" }], ["meal-plan/generate", { ...plan, householdId: "other-house" }]] as const) {
      await expect(handleProviders(request(path, body), env, user)).rejects.toMatchObject({ status: 403 });
    }
    expect(mocks.ai).not.toHaveBeenCalled();
    expect(mocks.member).toHaveBeenCalledWith(env, "other-house", "user-a");
  });
  it("rejects mismatched image signatures before AI invocation", async () => {
    const imageBase64 = Buffer.from("<html>not an image</html>").toString("base64");
    await expect(handleProviders(request("pantry/recognize", { householdId: "house-a", imageBase64, mediaType: "image/png" }), env, user)).rejects.toMatchObject({ status: 400 });
    expect(mocks.ai).not.toHaveBeenCalled();
  });
  it("returns only food name and category for manual photo review", async () => {
    mocks.ai.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ items: [{ name: "Tomato", category: "Produce", expiryDate: "2030-01-01", instructions: "discard other data" }] }) } }] });
    const imageBase64 = Buffer.from("\x89PNG\r\n\x1a\n", "binary").toString("base64");
    const response = await handleProviders(request("pantry/recognize", { householdId: "house-a", imageBase64, mediaType: "image/png" }), env, user);
    expect(await response!.json()).toEqual({ items: [{ name: "Tomato", category: "Produce" }] });
  });
  it("rejects fabricated recipe IDs and duplicate AI meal slots", async () => {
    for (const entries of [[{ date: "2026-09-21", meal: "dinner", recipeId: "unoffered-recipe" }], [{ date: "2026-09-21", meal: "dinner", recipeId: "recipe-a" }, { date: "2026-09-21", meal: "dinner", recipeId: "recipe-a" }]]) {
      mocks.ai.mockResolvedValue({ response: JSON.stringify({ entries }) });
      await expect(handleProviders(request("meal-plan/generate", entries.length === 2 ? { ...plan, meals: ["dinner", "lunch"] } : plan), env, user)).rejects.toMatchObject({ status: 502 });
    }
  });
  it("limits expensive providers before contacting upstream services", async () => {
    mocks.limit.mockResolvedValue({ success: false });
    await expect(handleProviders(request("meal-plan/generate", plan), env, user)).rejects.toMatchObject({ status: 429 });
    expect(mocks.ai).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("stops when membership was revoked between the first check and pantry read", async () => {
    const revoked = { ...env, DB: { prepare: () => ({ bind: () => ({}) }), batch: async () => [{ results: [] }, { results: [] }] } } as unknown as Env;
    await expect(handleProviders(request("meal-plan/generate", plan), revoked, user)).rejects.toMatchObject({ status: 403 });
    expect(mocks.ai).not.toHaveBeenCalled();
  });
  it("fails clearly when the optional recipe key is absent", async () => {
    await expect(handleProviders(request("recipes/search", { action: "search", query: "beans" }), env, user)).rejects.toMatchObject({ status: 503, code: "provider_unavailable" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("sends provider credentials only as a header to the fixed upstream host", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ results: [{ id: 1 }] }));
    const response = await handleProviders(request("recipes/search", { action: "search", query: "beans" }), { ...env, SPOONACULAR_API_KEY: "private-provider-key" }, user);
    expect(response!.status).toBe(200);
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(url.origin).toBe("https://api.spoonacular.com");
    expect(url.toString()).not.toContain("private-provider-key");
    expect(options.headers["x-api-key"]).toBe("private-provider-key");
    expect(options.redirect).toBe("error");
  });
});
