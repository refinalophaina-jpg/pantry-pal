import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { identityKey, useAppStore, refreshHouseholdData, availableQuantity } from "./store";
import { invalidateApiRequests } from "./api-client";
import type { Recipe } from "./types";
const ctx = { householdId: "h1", userId: "u1" };
const fetchMock = vi.fn();
const empty = { pantry_items: [], shopping_items: [], meal_plan: [], usage_events: [], saved_recipes: [], sequence: 1, epoch: "v1" };
const rice = { id: "p1", household_id: "h1", name: "Rice", category: "Grains", quantity: 3, unit: "cup", zone: "pantry", expires_on: null, added_on: "2026-06-01", notes: null };
const recipe: Recipe = { id: "saved-r1", savedId: "r1", name: "Rice", description: "", cuisine: "Test", minutes: 20, difficulty: "easy", servings: 2, equipment: [], ingredients: [{ name: "Rice", quantity: 2, unit: "cup" }], steps: ["Cook"], tags: [] };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const requestBody = (index = 0) => JSON.parse(fetchMock.mock.calls[index][1].body);
beforeEach(() => {
  invalidateApiRequests();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  useAppStore.setState({ _identity: identityKey(ctx), pantry: [], shopping: [], mealPlan: [], usage: [], savedRecipes: [], recipes: [], syncStatus: "online" });
});
afterEach(() => vi.unstubAllGlobals());

describe("Workers-backed household actions", () => {
  it("inserts through a household route without trusting a caller user id", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: rice }));
    await useAppStore.getState().addPantryItem({ name: "Rice", category: "Grains", quantity: 3, unit: "cup", zone: "pantry" }, ctx);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/households/h1/pantry");
    expect(requestBody()).not.toHaveProperty("created_by");
    expect(requestBody()).not.toHaveProperty("household_id");
    expect(useAppStore.getState().pantry[0].id).toBe("p1");
  });
  it("keeps local data on rejected writes", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: { message: "denied", code: "forbidden" } }, 403));
    await expect(useAppStore.getState().addPantryItem({ name: "Rice", category: "Grains", quantity: 3, unit: "cup", zone: "pantry" }, ctx)).rejects.toThrow("denied");
    expect(useAppStore.getState().pantry).toEqual([]);
  });
  it("clears optional expiry and notes when the edit form submits blank fields", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: rice }));
    await useAppStore.getState().updatePantryItem("p1", { expiresOn: "", notes: "" }, ctx);
    expect(requestBody()).toMatchObject({ expires_on: null, notes: "" });
  });
  it("consumes with one atomic operation, then reconciles stock and history", async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true })).mockResolvedValueOnce(json({ ...empty, pantry_items: [{ ...rice, quantity: 2 }], usage_events: [{ id: "event", item_id: "p1", item_name: "Rice", quantity: 1, unit: "cup", reason: "used", at: "2026-01-01" }] }));
    await useAppStore.getState().consumeItem("p1", 1, "used", ctx);
    expect(requestBody()).toMatchObject({ type: "consume", itemId: "p1", quantity: 1 });
    expect(requestBody().operationId).toBeTruthy();
    expect(useAppStore.getState().pantry[0].quantity).toBe(2);
    expect(useAppStore.getState().usage).toHaveLength(1);
  });
  it("reuses an operation id after an uncertain response", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network"));
    await expect(useAppStore.getState().consumeItem("p1", 0.25, "wasted", ctx)).rejects.toThrow("network");
    const firstId = requestBody().operationId;
    fetchMock.mockResolvedValueOnce(json({ ok: true })).mockResolvedValueOnce(json(empty));
    await useAppStore.getState().consumeItem("p1", 0.25, "wasted", ctx);
    expect(requestBody(1).operationId).toBe(firstId);
  });
  it("moves purchases with one server operation", async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true })).mockResolvedValueOnce(json(empty));
    await useAppStore.getState().moveShoppingToPantry("shop1", ctx);
    expect(requestBody()).toMatchObject({ type: "move-shopping", itemId: "shop1" });
  });
  it("sends an explicit checked value and expected revision", async () => {
    useAppStore.setState({ shopping: [{ id: "s1", name: "Rice", quantity: 1, unit: "cup", category: "Grains", done: false, revision: 7 }] });
    fetchMock.mockResolvedValueOnce(json({ ok: true })).mockResolvedValueOnce(json(empty));
    await useAppStore.getState().toggleShoppingItem("s1", ctx);
    expect(requestBody()).toMatchObject({ type: "set-checked", done: true, expectedRevision: 7 });
  });
  it("cooks a saved recipe at the selected serving scale", async () => {
    useAppStore.setState({ savedRecipes: [recipe], pantry: [{ id: "p1", name: "Rice", quantity: 10, unit: "cup", category: "Grains", zone: "pantry", addedOn: "2026-01-01" }] });
    fetchMock.mockResolvedValueOnce(json({ ok: true })).mockResolvedValueOnce(json(empty));
    expect((await useAppStore.getState().cookRecipe("saved-r1", ctx, 4)).ok).toBe(true);
    expect(requestBody()).toMatchObject({ type: "cook", recipeId: "saved-r1", ingredients: [{ name: "Rice", quantity: 4, unit: "cup" }] });
  });
  it("does not deduct a recipe with missing or incompatible units", async () => {
    useAppStore.setState({ pantry: [{ id: "p1", name: "Rice", quantity: 100, unit: "g", category: "Grains", zone: "pantry", addedOn: "2026-01-01" }] });
    expect(await useAppStore.getState().cookRecipe(recipe, ctx)).toEqual({ ok: false, missing: ["Rice"] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("adds only scaled deficit after subtracting pantry and outstanding shopping", async () => {
    useAppStore.setState({ shopping: [{ id: "s1", name: "Rice", quantity: 1, unit: "cup", category: "Grains", done: false }], pantry: [{ id: "p1", name: "Rice", quantity: 1, unit: "cup", category: "Grains", zone: "pantry", addedOn: "2026-01-01" }] });
    fetchMock.mockResolvedValueOnce(json({ ok: true })).mockResolvedValueOnce(json(empty));
    await useAppStore.getState().generateFromRecipe(recipe, ctx, 4);
    expect(requestBody()).toMatchObject({ type: "add-shopping-batch", items: [{ name: "Rice", quantity: 2, unit: "cup" }] });
  });
  it("leaves a moved meal unchanged on failure", async () => {
    const entry = { id: "m1", date: "2026-09-21", meal: "dinner" as const, recipeId: "r1" };
    useAppStore.setState({ mealPlan: [entry] });
    fetchMock.mockResolvedValueOnce(json({ error: { message: "denied" } }, 403));
    await expect(useAppStore.getState().moveMealPlan("m1", { date: "2026-09-22", meal: "lunch" }, ctx)).rejects.toThrow("denied");
    expect(useAppStore.getState().mealPlan).toEqual([entry]);
  });
  it("rejects a late snapshot for a previous household", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const task = refreshHouseholdData(ctx);
    useAppStore.setState({ _identity: "u2:h2" });
    finish(json({ ...empty, pantry_items: [rice] }));
    await task;
    expect(useAppStore.getState().pantry).toEqual([]);
  });
  it("sums compatible units without inventing mass-to-volume conversions", () => {
    expect(availableQuantity([{ name: "Milk", quantity: 1, unit: "l" }, { name: "Milk", quantity: 500, unit: "ml" }], "milk", "ml")).toBe(1500);
    expect(availableQuantity([{ name: "Rice", quantity: 500, unit: "g" }], "Rice", "cup")).toBe(0);
  });
  it("does not send an action captured under another identity", async () => {
    useAppStore.setState({ _identity: "u2:h2" });
    await expect(useAppStore.getState().removePantryItem("p1", ctx)).rejects.toThrow("household changed");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not let an older snapshot overwrite a confirmed mutation", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const task = refreshHouseholdData(ctx);
    fetchMock.mockResolvedValueOnce(json({ data: rice }));
    await useAppStore.getState().addPantryItem({ name: "Rice", category: "Grains", quantity: 3, unit: "cup", zone: "pantry" }, ctx);
    finish(json(empty));
    await task;
    expect(useAppStore.getState().pantry[0].id).toBe("p1");
  });
  it("combines compatible recipe units before subtracting pantry stock", async () => {
    const milkRecipe = { ...recipe, ingredients: [{ name: "Milk", quantity: 1, unit: "l" as const }, { name: "milk", quantity: 500, unit: "ml" as const }] };
    useAppStore.setState({ pantry: [{ id: "p1", name: "Milk", quantity: 1, unit: "l", category: "Dairy", zone: "fridge", addedOn: "2026-01-01" }] });
    fetchMock.mockResolvedValueOnce(json({ ok: true })).mockResolvedValueOnce(json(empty));
    await useAppStore.getState().generateFromRecipe(milkRecipe, ctx);
    expect(requestBody()).toMatchObject({ type: "add-shopping-batch", items: [{ name: "Milk", quantity: 0.5, unit: "l" }] });
  });

});
