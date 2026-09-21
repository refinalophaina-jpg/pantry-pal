import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { searchRecipes, randomRecipes } from "./spoonacular";
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());
const respond = (value: unknown, status = 200) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } }));
describe("recipe provider API", () => {
  it("sends search options to the same-origin Worker and maps results", async () => {
    respond({ items: [{ id: 5, title: "Soup" }] });
    expect((await searchRecipes({ query: "soup", number: 16 }))[0].id).toBe("sp-5");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/recipes/search");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: "search", query: "soup", number: 16 });
  });
  it("reports quota/provider errors", async () => { respond({ error: { message: "quota exceeded" } }, 429); await expect(searchRecipes({ query: "x" })).rejects.toThrow("quota exceeded"); });
  it("accepts a valid empty random result", async () => { respond({ items: [] }); expect(await randomRecipes(8)).toEqual([]); });
});
