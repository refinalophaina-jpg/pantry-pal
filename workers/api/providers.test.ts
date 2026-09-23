// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleProviders } from "./providers";
import { ApiError } from "./domain-validation";
const mocks = vi.hoisted(() => ({ member: vi.fn(), ai: vi.fn(), limit: vi.fn(), fetch: vi.fn() }));
vi.mock("./domain-repository", async (original) => ({ ...await original<typeof import("./domain-repository")>(), requireMember: mocks.member }));
const env = { AI: { run: mocks.ai }, PROVIDER_LIMITER: { limit: mocks.limit }, DB: { prepare: () => ({ bind: () => ({}) }), batch: async () => [{ results: [{ role: 'owner' }] }, { results: [{ name: 'Eggs', quantity: 6, unit: 'pcs', expires_on: null }] }] } } as unknown as Env;
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
  it("keeps a plan's short reasons, accepts a brief with coverage, and drops oversized reasons", async () => {
    mocks.ai.mockResolvedValue({ response: { entries: [{ date: "2026-09-21", meal: "dinner", recipeId: "recipe-a", why: " Uses the eggs before Friday " }] } });
    const response = await handleProviders(request("meal-plan/generate", { ...plan, brief: "Light, fibre-rich, Vietnamese and Thai", candidates: [{ id: "recipe-a", name: "Beans", minutes: 20, tags: ["vegan"], coverage: 0.75 }] }), env, user);
    expect(await response!.json()).toEqual({ entries: [{ date: "2026-09-21", meal: "dinner", recipeId: "recipe-a", why: "Uses the eggs before Friday" }] });
    const [, options] = mocks.ai.mock.calls[0];
    expect(options.messages[1].content).toContain("Light, fibre-rich");
    expect(JSON.parse(options.messages[1].content).candidates[0]).toEqual({ id: "recipe-a", name: "Beans", cuisine: "", minutes: 20, tags: ["vegan"], coverage: 0.75 });
    await expect(handleProviders(request("meal-plan/generate", { ...plan, candidates: [{ id: "recipe-a", name: "Beans", coverage: 4 }] }), env, user)).rejects.toMatchObject({ status: 400 });
  });
  it("drafts pantry dishes, re-validates every field, and never trusts model units or ids", async () => {
    mocks.ai.mockResolvedValue({ response: JSON.stringify({ dishes: [
      { id: "evil", name: "Egg fried rice", description: "Golden rice with soft eggs.", cuisine: "Chinese", minutes: 20, difficulty: "silly", servings: 2, ingredients: [{ name: "Eggs", quantity: 3, unit: "large", fromPantry: true }, { name: "Rice", quantity: 300, unit: "grams" }], steps: ["Beat the eggs.", "Fry the rice over high heat for 4 minutes."], tags: ["quick", "quick"], why: "Uses the eggs" },
      { name: "No steps", ingredients: [{ name: "Eggs" }], steps: [] },
    ] }) });
    const response = await handleProviders(request("recipes/invent", { householdId: "house-a", brief: "quick", count: 2 }), env, user);
    const { dishes } = await response!.json();
    expect(dishes).toHaveLength(1);
    expect(dishes[0]).toMatchObject({ name: "Egg fried rice", cuisine: "Chinese", minutes: 20, difficulty: "easy", servings: 2, tags: ["drafted", "quick"], why: "Uses the eggs" });
    expect(dishes[0].id).toMatch(/^ai-[0-9a-f-]{36}$/);
    expect(dishes[0].ingredients).toEqual([{ name: "Eggs", quantity: 3, unit: "pcs", fromPantry: true }, { name: "Rice", quantity: 300, unit: "g", fromPantry: false }]);
    const [, options] = mocks.ai.mock.calls[0];
    expect(JSON.parse(options.messages[1].content).pantry).toEqual([{ name: "Eggs", quantity: 6, unit: "pcs", expires_on: null }]);
    expect(options.response_format).toEqual({ type: "json_object" });
  });
  it("refuses to draft from an empty pantry and rejects unknown draft options", async () => {
    const empty = { ...env, DB: { prepare: () => ({ bind: () => ({}) }), batch: async () => [{ results: [{ role: 'owner' }] }, { results: [] }] } } as unknown as Env;
    await expect(handleProviders(request("recipes/invent", { householdId: "house-a" }), empty, user)).rejects.toMatchObject({ status: 400, code: "pantry_empty" });
    await expect(handleProviders(request("recipes/invent", { householdId: "house-a", model: "other" }), env, user)).rejects.toMatchObject({ status: 400 });
    expect(mocks.ai).not.toHaveBeenCalled();
  });
  it("stores a generated illustration only when the model returns a real image", async () => {
    mocks.ai.mockResolvedValue({ image: Buffer.from("\xff\xd8\xff" + "x".repeat(32), "binary").toString("base64") });
    const stored = { ...env, DB: { prepare: () => ({ bind: () => ({ first: async () => ({ id: "img-1" }) }) }) } } as unknown as Env;
    const response = await handleProviders(request("recipes/illustrate", { householdId: "house-a", name: "Pho", cuisine: "Vietnamese", description: "Line one\nline two" }), stored, user);
    expect(await response!.json()).toEqual({ imageUrl: "/api/households/house-a/images/img-1", mediaType: "image/jpeg" });
    const [model, options] = mocks.ai.mock.calls[0];
    expect(model).toBe("@cf/black-forest-labs/flux-1-schnell");
    expect(options.prompt).toContain("Pho, Vietnamese cuisine");
    expect(options.prompt).not.toContain("\n");
    mocks.ai.mockResolvedValue({ image: Buffer.from("<svg/>").toString("base64") });
    await expect(handleProviders(request("recipes/illustrate", { householdId: "house-a", name: "Pho" }), stored, user)).rejects.toMatchObject({ status: 502 });
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
  it("searches by pantry ingredients and caches complete results into the shared catalog", async () => {
    const batch = vi.fn(async () => []);
    const bind = vi.fn(() => ({}));
    const caching = { ...env, SPOONACULAR_API_KEY: "k", DB: { prepare: () => ({ bind }), batch } } as unknown as Env;
    const full = { id: 7, title: "Egg curry", readyInMinutes: 25, servings: 2, cuisines: ["Indian"], image: "https://img.spoonacular.com/recipes/7-556x370.jpg", extendedIngredients: [{ nameClean: "eggs", amount: 4, unit: "" }], analyzedInstructions: [{ steps: [{ step: "Boil the eggs." }] }] };
    mocks.fetch.mockResolvedValue(Response.json({ results: [full, { id: 8, title: "No instructions" }] }));
    const response = await handleProviders(request("recipes/search", { action: "search", includeIngredients: ["eggs", "rice, basmati"], number: 5 }), caching, user);
    expect((await response!.json()).items).toHaveLength(2);
    const [url] = mocks.fetch.mock.calls[0];
    expect(url.searchParams.get("includeIngredients")).toBe("eggs,rice  basmati");
    expect(url.searchParams.get("sort")).toBe("max-used-ingredients");
    expect(url.searchParams.get("instructionsRequired")).toBe("true");
    expect(batch).toHaveBeenCalledTimes(1);
    expect(bind).toHaveBeenCalledTimes(1);
    expect(bind.mock.calls[0].slice(0, 3)).toEqual(["sp-7", "sp-7", "Egg curry"]);
    expect(bind.mock.calls[0]).toContain("spoonacular");
    await expect(handleProviders(request("recipes/search", { action: "search", includeIngredients: [] }), caching, user)).rejects.toMatchObject({ status: 400 });
    await expect(handleProviders(request("recipes/search", { action: "search", diet: "carnivore" }), caching, user)).rejects.toMatchObject({ status: 400 });
  });
});
