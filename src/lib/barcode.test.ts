import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  barcodeVariants,
  bucketForCategory,
  nutritionFromOffNutriments,
  scannedFromCatalog,
  scannedFromOff,
  lookupProduct,
} from "./barcode";
import type { FoodProduct } from "./food-db";

const h = vi.hoisted(() => ({
  lookupFoodByBarcode: vi.fn(),
}));
vi.mock("./food-db", () => ({
  lookupFoodByBarcode: h.lookupFoodByBarcode,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bucketForCategory", () => {
  it("maps OFF tags to pantry categories", () => {
    expect(bucketForCategory("en:dairy en:cheeses")).toBe("Dairy");
    expect(bucketForCategory("en:frozen-foods")).toBe("Frozen");
    expect(bucketForCategory("en:olive-oils")).toBe("Oils");
    expect(bucketForCategory("something-unrecognizable")).toBe("Other");
  });
});

describe("nutritionFromOffNutriments", () => {
  it("maps per-100g nutriments including sodium g→mg", () => {
    const facts = nutritionFromOffNutriments({
      "energy-kcal_100g": 539,
      proteins_100g: "6.3", // OFF sometimes sends numeric strings
      carbohydrates_100g: 57.5,
      fat_100g: 30.9,
      "saturated-fat_100g": 10.6,
      sugars_100g: 56.3,
      fiber_100g: 0,
      sodium_100g: 0.0428,
    });
    expect(facts).toEqual({
      calories: 539,
      proteinG: 6.3,
      carbsG: 57.5,
      fatG: 30.9,
      saturatedFatG: 10.6,
      sugarsG: 56.3,
      fiberG: 0,
      sodiumMg: 43,
    });
  });

  it("derives kcal from kJ when only energy_100g exists", () => {
    const facts = nutritionFromOffNutriments({ energy_100g: 2255 });
    expect(facts?.calories).toBe(539);
  });

  it("returns undefined for missing or empty nutriments", () => {
    expect(nutritionFromOffNutriments(undefined)).toBeUndefined();
    expect(nutritionFromOffNutriments({})).toBeUndefined();
    expect(nutritionFromOffNutriments({ proteins_100g: "not-a-number" })).toBeUndefined();
  });
});

describe("scannedFromCatalog", () => {
  const base: FoodProduct = {
    id: "f1",
    barcode: "3017620422003",
    name: "Nutella",
    brand: "Ferrero",
    category: "spreads",
    servingSize: "15 g",
    calories: 539,
    proteinG: 6.3,
    carbsG: 57.5,
    fatG: 30.9,
    fiberG: 0,
    source: "openfoodfacts",
  };

  it("joins brand + name and carries facts through", () => {
    const s = scannedFromCatalog(base);
    expect(s.name).toBe("Ferrero Nutella");
    expect(s.category).toBe("Condiments"); // "spreads" rule
    expect(s.nutrition?.calories).toBe(539);
    expect(s.servingSize).toBe("15 g");
    expect(s.source).toBe("catalog");
  });

  it("omits the nutrition object when the row has no facts", () => {
    const s = scannedFromCatalog({
      ...base,
      calories: undefined,
      proteinG: undefined,
      carbsG: undefined,
      fatG: undefined,
      fiberG: undefined,
    });
    expect(s.nutrition).toBeUndefined();
  });
});

describe("scannedFromOff", () => {
  it("maps a live OFF product with nutri-score", () => {
    const s = scannedFromOff({
      product_name: "Nutella",
      brands: "Ferrero, Ferrero Deutschland",
      categories_tags: ["en:breakfasts", "en:spreads"],
      serving_size: "15 g",
      nutriscore_grade: "E",
      nutriments: { "energy-kcal_100g": 539 },
    });
    expect(s?.name).toBe("Ferrero Nutella");
    expect(s?.nutriScore).toBe("e");
    expect(s?.nutrition?.calories).toBe(539);
    expect(s?.source).toBe("openfoodfacts");
  });

  it("rejects unnamed products and bogus grades", () => {
    expect(scannedFromOff({ brands: "" })).toBeNull();
    const s = scannedFromOff({
      product_name: "Mystery",
      nutriscore_grade: "unknown",
    });
    expect(s?.nutriScore).toBeUndefined();
  });
});

describe("barcodeVariants", () => {
  it("pairs UPC-A with its EAN-13 sibling and back", () => {
    expect(barcodeVariants("737628064502")).toEqual([
      "737628064502",
      "0737628064502",
    ]);
    expect(barcodeVariants("0737628064502")).toEqual([
      "0737628064502",
      "737628064502",
    ]);
  });

  it("leaves EAN-8 and non-zero EAN-13 alone, drops junk", () => {
    expect(barcodeVariants("3017620422003")).toEqual(["3017620422003"]);
    expect(barcodeVariants("12345678")).toEqual(["12345678"]);
    expect(barcodeVariants(" 12 34-5678 ")).toEqual(["12345678"]);
    expect(barcodeVariants("no-digits")).toEqual([]);
  });
});

describe("lookupProduct", () => {
  beforeEach(() => {
    h.lookupFoodByBarcode.mockReset();
  });

  it("prefers the catalog when it has nutrition", async () => {
    h.lookupFoodByBarcode.mockResolvedValue({
      id: "f1",
      name: "Nutella",
      brand: "Ferrero",
      category: "spreads",
      calories: 539,
      source: "openfoodfacts",
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const s = await lookupProduct("3017620422003");
    expect(s?.source).toBe("catalog");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fills facts from the live API when the catalog row has none", async () => {
    h.lookupFoodByBarcode.mockResolvedValue({
      id: "f1",
      name: "Nutella",
      brand: "Ferrero",
      category: "spreads",
      source: "openfoodfacts",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 1,
          product: {
            product_name: "Nutella",
            brands: "Ferrero",
            nutriments: { "energy-kcal_100g": 539 },
          },
        }),
      }),
    );
    const s = await lookupProduct("3017620422003");
    expect(s?.nutrition?.calories).toBe(539);
  });

  it("falls back to the catalog result when the live API also has nothing", async () => {
    h.lookupFoodByBarcode.mockResolvedValue({
      id: "f1",
      name: "Obscure Snack",
      category: "snacks",
      source: "openfoodfacts",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const s = await lookupProduct("000");
    expect(s?.name).toBe("Obscure Snack");
    expect(s?.nutrition).toBeUndefined();
  });

  it("uses the live API when the catalog misses, null when both miss", async () => {
    h.lookupFoodByBarcode.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 0 }),
      }),
    );
    expect(await lookupProduct("404")).toBeNull();
  });

  it("finds a product stored under the EAN-13 sibling of the scanned UPC-A", async () => {
    h.lookupFoodByBarcode.mockImplementation(async (code: string) =>
      code === "0737628064502"
        ? {
            id: "f2",
            name: "Rice Noodles",
            category: "grains",
            calories: 364,
            source: "openfoodfacts",
          }
        : null,
    );
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const s = await lookupProduct("737628064502");
    expect(s?.name).toBe("Rice Noodles");
    expect(h.lookupFoodByBarcode).toHaveBeenCalledWith("737628064502");
    expect(h.lookupFoodByBarcode).toHaveBeenCalledWith("0737628064502");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("survives a catalog error and a network error", async () => {
    h.lookupFoodByBarcode.mockRejectedValue(new Error("db down"));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await lookupProduct("123")).toBeNull();
  });
});
