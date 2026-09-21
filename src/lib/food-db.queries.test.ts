import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { searchIngredients, searchRecipeCatalog, lookupIngredientByName, lookupFoodByBarcode, listTechniques } from "./food-db";
const fetchMock = vi.fn();
const row = { id: "i1", slug: "tomato", name: "Tomato", category: "Produce", aliases: ["tomatoes"], calories: 18 };
const respond = (data: unknown) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data }), { headers: { "content-type": "application/json" } }));
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());
describe("catalog HTTP contracts", () => {
  it("encodes search text and limit and maps ingredient rows", async () => {
    respond([row]);
    expect((await searchIngredients("tom & onion", 8))[0].name).toBe("Tomato");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/catalog/ingredients?q=tom+%26+onion&limit=8");
  });
  it("does not turn a backend error into empty catalog results", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Unavailable" } }), { status: 503, headers: { "content-type": "application/json" } }));
    await expect(searchIngredients("rice")).rejects.toThrow("Unavailable");
  });
  it("maps recipe catalog identifiers", async () => { respond([{ slug: "curry", name: "Curry" }]); expect((await searchRecipeCatalog("curry"))[0].id).toBe("cat-curry"); });
  it("uses exact ingredient names and handles no match", async () => {
    respond(row); expect((await lookupIngredientByName(" Tomato "))?.slug).toBe("tomato");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/catalog/ingredients?name=tomato");
    respond(null); expect(await lookupIngredientByName("unknown")).toBeNull();
  });
  it("does not query an empty ingredient name", async () => { expect(await lookupIngredientByName(" ")).toBeNull(); expect(fetchMock).not.toHaveBeenCalled(); });
  it("preserves barcode leading zeros", async () => { respond({ id: "f1", name: "Milk", barcode: "00123" }); expect((await lookupFoodByBarcode("00123"))?.barcode).toBe("00123"); });
  it("filters techniques by an encoded category", async () => { respond([{ id: "t1", slug: "cut", title: "Cut", tags: [] }]); expect(await listTechniques("Knife skills")).toHaveLength(1); expect(fetchMock.mock.calls[0][0]).toContain("category=Knife+skills"); });
});
