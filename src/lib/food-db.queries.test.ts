import { describe, it, expect, vi, beforeEach } from "vitest";

// Chainable Supabase mock: records the last rpc call and resolves a
// configurable result for both rpc and query-builder chains.
const h = vi.hoisted(() => {
  const state: {
    rpc: { name: string; params: unknown } | null;
    result: { data: unknown; error: unknown };
  } = { rpc: null, result: { data: null, error: null } };
  const builder: Record<string, unknown> = {
    rpc(name: string, params: unknown) {
      state.rpc = { name, params };
      return Promise.resolve(state.result);
    },
    from() {
      return builder;
    },
    select() {
      return builder;
    },
    or() {
      return builder;
    },
    eq() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    maybeSingle() {
      return Promise.resolve(state.result);
    },
    then(r: (v: unknown) => unknown, j?: (e: unknown) => unknown) {
      return Promise.resolve(state.result).then(r, j);
    },
  };
  return { state, builder };
});

vi.mock("./supabase", () => ({ getSupabase: () => h.builder }));

import {
  searchIngredients,
  searchRecipeCatalog,
  lookupIngredientByName,
  lookupFoodByBarcode,
  listTechniques,
} from "./food-db";

beforeEach(() => {
  h.state.rpc = null;
  h.state.result = { data: null, error: null };
});

const ingredientRow = {
  id: "i1",
  slug: "tomato",
  name: "Tomato",
  category: "Produce",
  aliases: ["tomatoes"],
  calories: 18,
};

describe("searchIngredients", () => {
  it("calls the RPC with q + limit and maps rows", async () => {
    h.state.result = { data: [ingredientRow], error: null };
    const out = await searchIngredients("tom", 8);
    expect(h.state.rpc).toEqual({
      name: "search_ingredients",
      params: { q: "tom", lim: 8 },
    });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Tomato");
  });

  it("throws on RPC error", async () => {
    h.state.result = { data: null, error: { message: "boom" } };
    await expect(searchIngredients("x")).rejects.toThrow("boom");
  });
});

describe("searchRecipeCatalog", () => {
  it("calls the catalog RPC and maps rows to Recipe", async () => {
    h.state.result = {
      data: [{ slug: "curry", name: "Chickpea Curry", cuisine: "Indian" }],
      error: null,
    };
    const out = await searchRecipeCatalog("curry");
    expect(h.state.rpc?.name).toBe("search_recipe_catalog");
    expect(out[0].id).toBe("cat-curry");
    expect(out[0].cuisine).toBe("Indian");
  });
});

describe("lookupIngredientByName", () => {
  it("returns the first match mapped", async () => {
    h.state.result = { data: [ingredientRow], error: null };
    const ing = await lookupIngredientByName("Tomato");
    expect(ing?.slug).toBe("tomato");
  });

  it("returns null for an empty name without querying", async () => {
    expect(await lookupIngredientByName("   ")).toBeNull();
  });

  it("returns null when nothing matches", async () => {
    h.state.result = { data: [], error: null };
    expect(await lookupIngredientByName("nope")).toBeNull();
  });
});

describe("lookupFoodByBarcode", () => {
  it("maps a found product", async () => {
    h.state.result = {
      data: { id: "f1", name: "Oat Milk", barcode: "012", category: "Dairy" },
      error: null,
    };
    const f = await lookupFoodByBarcode("012");
    expect(f?.name).toBe("Oat Milk");
    expect(f?.barcode).toBe("012");
  });

  it("returns null when not found", async () => {
    h.state.result = { data: null, error: null };
    expect(await lookupFoodByBarcode("000")).toBeNull();
  });
});

describe("listTechniques", () => {
  it("maps rows to Technique[]", async () => {
    h.state.result = {
      data: [
        {
          id: "t1",
          slug: "searing",
          title: "Searing",
          category: "Heat & Protein",
          difficulty: "medium",
          summary: "Brown it.",
          tags: ["heat"],
        },
      ],
      error: null,
    };
    const out = await listTechniques();
    expect(out[0].title).toBe("Searing");
    expect(out[0].tags).toEqual(["heat"]);
  });

  it("throws on error", async () => {
    h.state.result = { data: null, error: { message: "nope" } };
    await expect(listTechniques()).rejects.toThrow("nope");
  });
});
