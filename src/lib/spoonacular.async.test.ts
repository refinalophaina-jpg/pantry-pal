import { describe, it, expect, vi, beforeEach } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("./supabase", () => ({
  getSupabase: () => ({ functions: { invoke } }),
}));

import { searchRecipes, randomRecipes } from "./spoonacular";

beforeEach(() => invoke.mockReset());

describe("searchRecipes", () => {
  it("invokes the edge function and maps items to Recipe[]", async () => {
    invoke.mockResolvedValueOnce({
      data: { items: [{ id: 5, title: "Soup" }] },
      error: null,
    });
    const out = await searchRecipes({ query: "soup", number: 16 });
    expect(invoke).toHaveBeenCalledWith("recipe-search", {
      body: { action: "search", query: "soup", number: 16 },
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("sp-5");
  });

  it("throws on a transport error", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(searchRecipes({ query: "x" })).rejects.toThrow("boom");
  });

  it("throws on an application error in the payload", async () => {
    invoke.mockResolvedValueOnce({ data: { error: "quota exceeded" }, error: null });
    await expect(searchRecipes({ query: "x" })).rejects.toThrow("quota exceeded");
  });
});

describe("randomRecipes", () => {
  it("requests random recipes and returns [] when empty", async () => {
    invoke.mockResolvedValueOnce({ data: { items: [] }, error: null });
    const out = await randomRecipes(8);
    expect(invoke).toHaveBeenCalledWith("recipe-search", {
      body: { action: "random", number: 8 },
    });
    expect(out).toEqual([]);
  });
});
