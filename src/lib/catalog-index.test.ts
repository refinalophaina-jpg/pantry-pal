import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRecipeIndexCache, fetchCatalogRecipe, loadRecipeIndex, readCachedIndex } from "./catalog-index";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("./api-client", () => ({ apiRequest: mocks.api }));
const row = { slug: "mealdb-1", name: "Pho", cuisine: "Vietnamese", minutes: 90, difficulty: "medium", servings: 4, imageUrl: null, source: "themealdb", tags: ["Soup"], ingredients: ["Beef bones"] };
beforeEach(() => { clearRecipeIndexCache(); mocks.api.mockReset(); localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); });

describe("recipe index cache", () => {
  it("loads once, shares the in-flight request, and keeps a copy on the device", async () => {
    mocks.api.mockResolvedValue({ data: [row] });
    const [a, b] = await Promise.all([loadRecipeIndex(), loadRecipeIndex()]);
    expect(a).toBe(b);
    expect(mocks.api).toHaveBeenCalledTimes(1);
    expect(a[0]).toMatchObject({ slug: "mealdb-1", imageUrl: undefined, ingredients: ["Beef bones"] });
    expect(await loadRecipeIndex()).toBe(a);
    expect(JSON.parse(localStorage.getItem("pantry-pal-recipe-index-v1")!).entries).toHaveLength(1);
  });
  it("serves the stored copy before refreshing and survives a broken store", async () => {
    localStorage.setItem("pantry-pal-recipe-index-v1", JSON.stringify({ at: Date.now() - 3 * 60 * 60 * 1000, entries: [row] }));
    expect(readCachedIndex()?.[0].name).toBe("Pho");
    mocks.api.mockResolvedValue({ data: [{ ...row, name: "Pho bo" }] });
    expect((await loadRecipeIndex())[0].name).toBe("Pho bo");
    clearRecipeIndexCache();
    localStorage.setItem("pantry-pal-recipe-index-v1", "not json");
    expect(readCachedIndex()).toBeNull();
  });
  it("fetches one full recipe by slug and maps it to the app's Recipe shape", async () => {
    mocks.api.mockResolvedValue({ data: { slug: "mealdb-1", name: "Pho", ingredients: [{ name: "Beef", quantity: 1, unit: "kg" }], steps: ["Simmer."], tags: [], equipment: [] } });
    const recipe = await fetchCatalogRecipe("mealdb-1");
    expect(mocks.api).toHaveBeenCalledWith("/api/catalog/recipes?slug=mealdb-1");
    expect(recipe).toMatchObject({ id: "cat-mealdb-1", name: "Pho", ingredients: [{ name: "Beef", quantity: 1, unit: "kg" }] });
    mocks.api.mockResolvedValue({ data: null });
    expect(await fetchCatalogRecipe("gone")).toBeNull();
  });
});
