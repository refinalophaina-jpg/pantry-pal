import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listCategories,
  listAreas,
  filterByArea,
  searchByName,
  lookupMeal,
  randomMeals,
} from "./mealdb";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

function fullMeal(over: Record<string, string | null> = {}) {
  return {
    idMeal: "1",
    strMeal: "Test Dish",
    strDrinkAlternate: null,
    strCategory: "Misc",
    strArea: "Italian",
    strInstructions: "Step one. Step two.",
    strMealThumb: "http://img",
    strTags: null,
    strYoutube: null,
    strSource: null,
    strIngredient1: "salt",
    strMeasure1: "1 tsp",
    ...over,
  };
}

describe("listCategories / listAreas", () => {
  it("returns categories or an empty array", async () => {
    fetchMock.mockResolvedValueOnce(ok({ categories: [{ idCategory: "1" }] }));
    expect(await listCategories()).toHaveLength(1);
    fetchMock.mockResolvedValueOnce(ok({}));
    expect(await listCategories()).toEqual([]);
  });

  it("returns areas sorted", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ meals: [{ strArea: "Italian" }, { strArea: "Canadian" }] }),
    );
    expect(await listAreas()).toEqual(["Canadian", "Italian"]);
  });
});

describe("filterByArea", () => {
  it("returns the card list, or [] when null", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ meals: [{ idMeal: "1", strMeal: "X", strMealThumb: "t" }] }),
    );
    expect(await filterByArea("Italian")).toHaveLength(1);
    fetchMock.mockResolvedValueOnce(ok({ meals: null }));
    expect(await filterByArea("Nowhere")).toEqual([]);
  });
});

describe("searchByName / lookupMeal", () => {
  it("maps search results to Recipe[]", async () => {
    fetchMock.mockResolvedValueOnce(ok({ meals: [fullMeal({ idMeal: "52" })] }));
    const out = await searchByName("test");
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("mealdb-52");
  });

  it("searchByName returns [] when nothing matches", async () => {
    fetchMock.mockResolvedValueOnce(ok({ meals: null }));
    expect(await searchByName("zzz")).toEqual([]);
  });

  it("lookupMeal returns a Recipe or null", async () => {
    fetchMock.mockResolvedValueOnce(ok({ meals: [fullMeal({ idMeal: "9" })] }));
    expect((await lookupMeal("9"))?.id).toBe("mealdb-9");
    fetchMock.mockResolvedValueOnce(ok({ meals: null }));
    expect(await lookupMeal("0")).toBeNull();
  });

  it("throws when the response is not ok", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    await expect(searchByName("x")).rejects.toThrow(/MealDB/);
  });
});

describe("randomMeals", () => {
  it("dedupes by id across parallel calls", async () => {
    // every /random.php call returns the same meal -> dedupe to one
    fetchMock.mockResolvedValue(ok({ meals: [fullMeal({ idMeal: "7" })] }));
    const out = await randomMeals(3);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("mealdb-7");
  });

  it("tolerates a failed call (allSettled)", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ meals: [fullMeal({ idMeal: "a" })] }))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(ok({ meals: [fullMeal({ idMeal: "b" })] }));
    const out = await randomMeals(3);
    expect(out.map((r) => r.id).sort()).toEqual(["mealdb-a", "mealdb-b"]);
  });
});
