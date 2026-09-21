"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  PantryItem,
  Recipe,
  ShoppingItem,
  MealPlanEntry,
  UsageEvent,
  Equipment,
  StoreDeal,
  UnitType,
  StorageZone,
} from "./types";
import { ingredientName } from "./ingredient-name";
import { foodStorage } from "./food-storage";
import { prepPortion, prepDates } from "./prep-planner";
import { seedRecipes, seedEquipment, seedDeals } from "./seed-data";
import { ApiError, apiRequest, householdPath, requestDataRefresh as dispatchDataRefresh } from "./api-client";
import { saveOfflineShopping } from "./offline-shopping";

interface SyncedActionsCtx {
  householdId: string;
  userId: string;
  householdName?: string;
}

interface AppState {
  _identity: string | null;
  syncStatus: "loading" | "online" | "offline" | "error";
  syncError: string | null;
  lastSyncedAt: string | null;
  // Synced from the household Workers API
  pantry: PantryItem[];
  shopping: ShoppingItem[];
  mealPlan: MealPlanEntry[];
  usage: UsageEvent[];
  savedRecipes: Recipe[];

  // Local-only / seeded from code
  recipes: Recipe[];
  equipment: Equipment[];
  deals: StoreDeal[];

  // Sync setters (used by DataSync provider)
  _setPantry: (items: PantryItem[]) => void;
  _setShopping: (items: ShoppingItem[]) => void;
  _setMealPlan: (items: MealPlanEntry[]) => void;
  _setUsage: (items: UsageEvent[]) => void;
  _setSavedRecipes: (items: Recipe[]) => void;
  _upsertPantry: (item: PantryItem) => void;
  _removePantry: (id: string) => void;
  _upsertShopping: (item: ShoppingItem) => void;
  _removeShopping: (id: string) => void;
  _upsertMealPlan: (item: MealPlanEntry) => void;
  _removeMealPlan: (id: string) => void;
  _upsertUsage: (item: UsageEvent) => void;
  _upsertSavedRecipe: (item: Recipe) => void;
  _removeSavedRecipe: (id: string) => void;
  _clearAllSynced: () => void;

  // Mutations are authorized and applied by the household API.
  addPantryItem: (
    item: Omit<PantryItem, "id" | "addedOn">,
    ctx: SyncedActionsCtx,
  ) => Promise<void>;
  updatePantryItem: (
    id: string,
    patch: Partial<PantryItem>,
    ctx: SyncedActionsCtx,
  ) => Promise<void>;
  removePantryItem: (id: string, ctx: SyncedActionsCtx) => Promise<void>;
  consumeItem: (
    id: string,
    quantity: number,
    reason: "used" | "wasted",
    ctx: SyncedActionsCtx,
  ) => Promise<void>;
  cookRecipe: (
    recipe: string | Recipe,
    ctx: SyncedActionsCtx,
    servings?: number,
  ) => Promise<{ ok: boolean; missing: string[] }>;

  addShoppingItem: (
    item: Omit<ShoppingItem, "id" | "done">,
    ctx: SyncedActionsCtx,
  ) => Promise<void>;
  toggleShoppingItem: (id: string, ctx: SyncedActionsCtx) => Promise<void>;
  removeShoppingItem: (id: string, ctx: SyncedActionsCtx) => Promise<void>;
  clearCompleted: (ctx: SyncedActionsCtx) => Promise<void>;
  generateFromRecipe: (recipe: string | Recipe, ctx: SyncedActionsCtx, servings?: number) => Promise<void>;
  moveShoppingToPantry: (id: string, ctx: SyncedActionsCtx) => Promise<void>;
  buildWeekList: (dates: string[], ctx: SyncedActionsCtx) => Promise<number>;

  planPrep: (recipes: Recipe[], start: string, people: number, ctx: SyncedActionsCtx) => Promise<number>;
  addMealPlan: (
    entry: Omit<MealPlanEntry, "id">,
    ctx: SyncedActionsCtx,
  ) => Promise<void>;
  removeMealPlan: (id: string, ctx: SyncedActionsCtx) => Promise<void>;
  moveMealPlan: (
    id: string,
    target: { date: string; meal: MealPlanEntry["meal"] },
    ctx: SyncedActionsCtx,
  ) => Promise<void>;
  generateMealPlan: (
    opts: { dates: string[]; meals: string[]; preferences: string },
    ctx: SyncedActionsCtx,
  ) => Promise<number>;

  saveRecipe: (recipe: Recipe, ctx: SyncedActionsCtx) => Promise<string>;
  unsaveRecipe: (savedId: string, ctx: SyncedActionsCtx) => Promise<void>;

  toggleEquipment: (name: string) => void;
}

export const identityKey = (ctx: SyncedActionsCtx) => `${ctx.userId}:${ctx.householdId}`;
const isCurrent = (ctx: SyncedActionsCtx) => useAppStore.getState()._identity === identityKey(ctx);
const resource = (ctx: SyncedActionsCtx, kind: string, id?: string) => {
  if (!isCurrent(ctx)) throw new Error("Your household changed. Please retry.");
  return householdPath(ctx.householdId, kind, id);
};
const pendingOperations = new Map<string, string>();
function requestDataRefresh() {
  refreshOrder++;
  dispatchDataRefresh();
}

async function operation(ctx: SyncedActionsCtx, type: string, payload: Record<string, unknown>) {
  if (!isCurrent(ctx)) throw new Error("Your household changed. Please retry.");
  const key = JSON.stringify([identityKey(ctx), type, payload]);
  const operationId = pendingOperations.get(key) ?? crypto.randomUUID();
  pendingOperations.set(key, operationId);
  try {
    await apiRequest(resource(ctx, "operations"), { method: "POST", body: { operationId, type, ...payload } });
    pendingOperations.delete(key);
    requestDataRefresh();
    // A committed write remains successful if the follow-up read temporarily fails.
    await refreshHouseholdData(ctx).catch(() => {
      if (isCurrent(ctx)) useAppStore.setState({ syncStatus: "error", syncError: "Saved. Refreshing your household data failed; retry the refresh." });
    });
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) pendingOperations.delete(key);
    throw error;
  }
}

export function quantityInUnit(quantity: number, from: UnitType, to: UnitType): number | null {
  if (from === to) return quantity;
  const mass: Partial<Record<UnitType, number>> = { g: 1, kg: 1000 };
  const volume: Partial<Record<UnitType, number>> = { ml: 1, l: 1000, tsp: 4.92892159375, tbsp: 14.78676478125, cup: 236.5882365 };
  const units = mass[from] && mass[to] ? mass : volume[from] && volume[to] ? volume : null;
  return units ? quantity * units[from]! / units[to]! : null;
}

export function availableQuantity(items: Array<{ name: string; unit: UnitType; quantity: number }>, name: string, unit: UnitType) {
  return items.filter((item) => ingredientName(item.name) === ingredientName(name))
    .reduce((total, item) => total + (quantityInUnit(item.quantity, item.unit, unit) ?? 0), 0);
}

function resolveRecipe(value: string | Recipe): Recipe {
  const state = useAppStore.getState();
  const recipe = typeof value === "string" ? [...state.savedRecipes, ...state.recipes].find((r) => r.id === value) : value;
  if (!recipe) throw new Error("This recipe is unavailable. Open it and try again.");
  return recipe;
}

function mergeIngredientNeeds(ingredients: Recipe["ingredients"]) {
  const combined: Recipe["ingredients"] = [];
  for (const ing of ingredients.filter((i) => !i.optional)) {
    const previous = combined.find((p) => ingredientName(p.name) === ingredientName(ing.name) && quantityInUnit(ing.quantity, ing.unit, p.unit) !== null);
    if (previous) previous.quantity += quantityInUnit(ing.quantity, ing.unit, previous.unit)!;
    else combined.push({ ...ing });
  }
  return combined;
}

function scaledIngredients(recipe: Recipe, servings?: number) {
  const scale = (servings ?? recipe.servings) / Math.max(1, recipe.servings);
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("Choose a valid number of servings.");
  return mergeIngredientNeeds(recipe.ingredients.map((ing) => ({ ...ing, quantity: ing.quantity * scale })));
}

// DB row helpers ---------------------------------------------------
interface PantryRow {
  id: string;
  household_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  zone: string;
  expires_on: string | null;
  added_on: string;
  notes: string | null;
}

function pantryFromRow(row: PantryRow): PantryItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    quantity: Number(row.quantity),
    unit: row.unit as UnitType,
    zone: row.zone as StorageZone,
    expiresOn: row.expires_on ?? undefined,
    addedOn: row.added_on,
    notes: row.notes ?? undefined,
  };
}

interface ShoppingRow {
  id: string;
  household_id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  done: boolean | number;
  revision?: number;
  from_recipe: string | null;
  deal_price: number | null;
  deal_store: string | null;
}

function shoppingFromRow(row: ShoppingRow): ShoppingItem {
  return {
    id: row.id,
    name: row.name,
    quantity: Number(row.quantity),
    unit: row.unit as UnitType,
    category: row.category,
    done: Boolean(row.done),
    revision: row.revision,
    fromRecipe: row.from_recipe ?? undefined,
    dealPrice: row.deal_price ?? undefined,
    dealStore: row.deal_store ?? undefined,
  };
}

interface MealPlanRow {
  id: string;
  household_id: string;
  date: string;
  meal: string;
  recipe_id: string;
}

function mealPlanFromRow(row: MealPlanRow): MealPlanEntry {
  return {
    id: row.id,
    date: row.date,
    meal: row.meal as MealPlanEntry["meal"],
    recipeId: row.recipe_id,
  };
}

interface UsageRow {
  id: string;
  household_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  reason: string;
  at: string;
}

function usageFromRow(row: UsageRow): UsageEvent {
  return {
    id: row.id,
    itemId: row.item_id ?? "",
    itemName: row.item_name,
    quantity: Number(row.quantity),
    unit: row.unit as UnitType,
    reason: row.reason as "used" | "wasted",
    at: row.at,
  };
}

interface SavedRecipeRow {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  cuisine: string | null;
  minutes: number | null;
  difficulty: string | null;
  servings: number | null;
  equipment: string[] | null;
  ingredients: Recipe["ingredients"] | null;
  steps: string[] | null;
  tags: string[] | null;
  external_id: string | null;
  image_url: string | null;
  area: string | null;
  source: string | null;
  video: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

function savedRecipeFromRow(row: SavedRecipeRow): Recipe {
  return {
    id: `saved-${row.id}`,
    savedId: row.id,
    name: row.name,
    description: row.description ?? "",
    cuisine: row.cuisine ?? "Custom",
    minutes: row.minutes ?? 30,
    difficulty: (row.difficulty as Recipe["difficulty"]) ?? "easy",
    servings: row.servings ?? 2,
    equipment: row.equipment ?? [],
    ingredients: row.ingredients ?? [],
    steps: row.steps ?? [],
    tags: row.tags ?? [],
    externalId: row.external_id ?? undefined,
    imageUrl: row.image_url ?? undefined,
    area: row.area ?? undefined,
    source: row.source ?? undefined,
    video: row.video ?? undefined,
    calories: row.calories ?? undefined,
    proteinG: row.protein_g ? Number(row.protein_g) : undefined,
    carbsG: row.carbs_g ? Number(row.carbs_g) : undefined,
    fatG: row.fat_g ? Number(row.fat_g) : undefined,
  };
}

// Store ------------------------------------------------------------
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      _identity: null,
      syncStatus: "loading",
      syncError: null,
      lastSyncedAt: null,
      pantry: [],
      shopping: [],
      mealPlan: [],
      usage: [],
      savedRecipes: [],

      recipes: seedRecipes,
      equipment: seedEquipment,
      deals: seedDeals,

      _setPantry: (items) => set({ pantry: items }),
      _setShopping: (items) => set({ shopping: items }),
      _setMealPlan: (items) => set({ mealPlan: items }),
      _setUsage: (items) => set({ usage: items }),
      _setSavedRecipes: (items) => set({ savedRecipes: items }),
      _upsertPantry: (item) =>
        set((s) => ({
          pantry: s.pantry.some((p) => p.id === item.id)
            ? s.pantry.map((p) => (p.id === item.id ? item : p))
            : [...s.pantry, item],
        })),
      _removePantry: (id) =>
        set((s) => ({ pantry: s.pantry.filter((p) => p.id !== id) })),
      _upsertShopping: (item) =>
        set((s) => ({
          shopping: s.shopping.some((p) => p.id === item.id)
            ? s.shopping.map((p) => (p.id === item.id ? item : p))
            : [...s.shopping, item],
        })),
      _removeShopping: (id) =>
        set((s) => ({ shopping: s.shopping.filter((p) => p.id !== id) })),
      _upsertMealPlan: (item) =>
        set((s) => ({
          mealPlan: s.mealPlan.some((p) => p.id === item.id)
            ? s.mealPlan.map((p) => (p.id === item.id ? item : p))
            : [...s.mealPlan, item],
        })),
      _removeMealPlan: (id) =>
        set((s) => ({ mealPlan: s.mealPlan.filter((p) => p.id !== id) })),
      _upsertUsage: (item) =>
        set((s) => ({
          usage: s.usage.some((p) => p.id === item.id)
            ? s.usage.map((p) => (p.id === item.id ? item : p))
            : [...s.usage, item],
        })),
      _upsertSavedRecipe: (item) =>
        set((s) => ({
          savedRecipes: s.savedRecipes.some((p) => p.id === item.id)
            ? s.savedRecipes.map((p) => (p.id === item.id ? item : p))
            : [...s.savedRecipes, item],
        })),
      _removeSavedRecipe: (id) =>
        set((s) => ({
          savedRecipes: s.savedRecipes.filter((p) => p.id !== id),
        })),
      _clearAllSynced: () => {
        pendingOperations.clear();
        refreshOrder++;
        set({
          pantry: [],
          shopping: [],
          mealPlan: [],
          usage: [],
          savedRecipes: [],
        });
      },

      addPantryItem: async (item, ctx) => {
        const { data } = await apiRequest<{ data: PantryRow }>(resource(ctx, "pantry"), { method: "POST", body: {
          name: item.name, category: item.category, quantity: item.quantity, unit: item.unit,
          zone: item.zone, expires_on: item.expiresOn ?? null, notes: item.notes ?? null,
        } });
        if (isCurrent(ctx)) get()._upsertPantry(pantryFromRow(data));
        requestDataRefresh();
      },
      updatePantryItem: async (id, patch, ctx) => {
        const body: Record<string, unknown> = {};
        for (const key of ["name", "category", "quantity", "unit", "zone", "notes"] as const) if (patch[key] !== undefined) body[key] = patch[key];
        if (patch.expiresOn !== undefined) body.expires_on = patch.expiresOn || null;
        const { data } = await apiRequest<{ data: PantryRow }>(resource(ctx, "pantry", id), { method: "PATCH", body });
        if (isCurrent(ctx)) get()._upsertPantry(pantryFromRow(data));
        requestDataRefresh();
      },
      removePantryItem: async (id, ctx) => {
        await apiRequest(resource(ctx, "pantry", id), { method: "DELETE" });
        if (isCurrent(ctx)) get()._removePantry(id);
        requestDataRefresh();
      },
      consumeItem: async (id, quantity, reason, ctx) => {
        await operation(ctx, "consume", { itemId: id, quantity, reason });
      },
      cookRecipe: async (value, ctx, servings) => {
        const recipe = resolveRecipe(value);
        const ingredients = scaledIngredients(recipe, servings);
        if (!ingredients.length) throw new Error("This recipe has no ingredient quantities to deduct.");
        const missing = ingredients.filter((ing) => availableQuantity(get().pantry, ing.name, ing.unit) + 1e-8 < ing.quantity).map((ing) => ing.name);
        if (missing.length) return { ok: false, missing };
        try { await operation(ctx, "cook", { recipeId: recipe.id, ingredients }); }
        catch (error) {
          const details = error instanceof ApiError ? error.details as { missing?: string[] } | undefined : undefined;
          if (details?.missing) return { ok: false, missing: details.missing };
          throw error;
        }
        return { ok: true, missing: [] };
      },
      addShoppingItem: async (item, ctx) => {
        const { data } = await apiRequest<{ data: ShoppingRow }>(resource(ctx, "shopping"), { method: "POST", body: {
          name: item.name, quantity: item.quantity, unit: item.unit, category: item.category,
          from_recipe: item.fromRecipe ?? null, deal_price: item.dealPrice ?? null, deal_store: item.dealStore ?? null,
        } });
        if (isCurrent(ctx)) get()._upsertShopping(shoppingFromRow(data));
        requestDataRefresh();
      },
      toggleShoppingItem: async (id, ctx) => {
        const item = get().shopping.find((s) => s.id === id);
        if (!item) return;
        await operation(ctx, "set-checked", { itemId: id, done: !item.done, expectedRevision: item.revision });
      },
      removeShoppingItem: async (id, ctx) => {
        await apiRequest(resource(ctx, "shopping", id), { method: "DELETE" });
        if (isCurrent(ctx)) get()._removeShopping(id);
        requestDataRefresh();
      },
      moveShoppingToPantry: async (id, ctx) => { const item = get().shopping.find(s => s.id === id); await operation(ctx, "move-shopping", { itemId: id, zone: item ? foodStorage(item.name).zone : "pantry" }); },
      clearCompleted: async (ctx) => {
        if (get().shopping.some((s) => s.done)) await operation(ctx, "clear-completed", {});
      },
      generateFromRecipe: async (value, ctx, servings) => {
        const recipe = resolveRecipe(value);
        const items = scaledIngredients(recipe, servings).flatMap((ing) => {
          const deficit = ing.quantity - availableQuantity(get().pantry, ing.name, ing.unit) - availableQuantity(get().shopping.filter((s) => !s.done), ing.name, ing.unit);
          return deficit > 1e-8 ? [{ name: ing.name, quantity: Math.max(0.001, Math.round(deficit * 1000) / 1000), unit: ing.unit, category: foodStorage(ing.name).category, from_recipe: recipe.name }] : [];
        });
        if (items.length) await operation(ctx, "add-shopping-batch", { items });
      },
      buildWeekList: async (dates, ctx) => {
        const { mealPlan, recipes, savedRecipes, pantry, shopping } = get();
        const all = [...savedRecipes, ...recipes];
        const ingredients: Recipe["ingredients"] = [];
        for (const entry of mealPlan.filter((m) => dates.includes(m.date))) {
          const recipe = all.find((r) => r.id === entry.recipeId);
          if (!recipe) throw new Error("A planned recipe is unavailable. Save it again before building the list.");
          ingredients.push(...scaledIngredients(recipe));
        }
        const items = mergeIngredientNeeds(ingredients).flatMap((item) => {
          const deficit = item.quantity - availableQuantity(pantry, item.name, item.unit) - availableQuantity(shopping.filter((s) => !s.done), item.name, item.unit);
          return deficit > 1e-8 ? [{ name: item.name, unit: item.unit, quantity: Math.max(0.001, Math.round(deficit * 1000) / 1000), category: foodStorage(item.name).category, from_recipe: "Weekly meal plan" }] : [];
        });
        if (items.length) await operation(ctx, "add-shopping-batch", { items });
        return items.length;
      },
      planPrep: async (recipes, start, people, ctx) => {
        if (recipes.length !== 2) throw new Error("Choose a lunch and dinner recipe.");
        const dates = prepDates(start);
        const entries: Array<{date: string; meal: string; recipe_id: string; recipe_name: string}> = [];
        for (const [index, recipe] of recipes.entries()) {
          const meal = index === 0 ? 'lunch' : 'dinner';
          const emptyDates = dates.filter(date => !get().mealPlan.some(entry => entry.date === date && entry.meal === meal));
          if (!emptyDates.length) continue;
          const portion = prepPortion(recipe, people);
          const existing = get().savedRecipes.find(item => item.externalId === portion.externalId);
          const recipeId = existing?.id ?? await get().saveRecipe(portion, ctx);
          for (const date of emptyDates) entries.push({date, meal, recipe_id: recipeId, recipe_name: portion.name});
        }
        if (entries.length) await operation(ctx, 'add-meal-plan-batch', { entries });
        return entries.length;
      },
      addMealPlan: async (entry, ctx) => {
        const recipe = [...get().savedRecipes, ...get().recipes].find((r) => r.id === entry.recipeId);
        const { data } = await apiRequest<{ data: MealPlanRow }>(resource(ctx, "meal-plan"), { method: "POST", body: { date: entry.date, meal: entry.meal, recipe_id: entry.recipeId, recipe_name: recipe?.name ?? null } });
        if (isCurrent(ctx)) get()._upsertMealPlan(mealPlanFromRow(data));
        requestDataRefresh();
      },
      removeMealPlan: async (id, ctx) => {
        await apiRequest(resource(ctx, "meal-plan", id), { method: "DELETE" });
        if (isCurrent(ctx)) get()._removeMealPlan(id);
        requestDataRefresh();
      },
      moveMealPlan: async (id, target, ctx) => {
        const existing = get().mealPlan.find((m) => m.id === id);
        if (!existing || (existing.date === target.date && existing.meal === target.meal)) return;
        const { data } = await apiRequest<{ data: MealPlanRow }>(resource(ctx, "meal-plan", id), { method: "PATCH", body: target });
        if (isCurrent(ctx)) get()._upsertMealPlan(mealPlanFromRow(data));
        requestDataRefresh();
      },
      generateMealPlan: async (opts, ctx) => {
        const recipes = [...get().savedRecipes, ...get().recipes];
        const candidates = recipes.map(({ id, name, cuisine, tags, minutes }) => ({ id, name, cuisine, tags, minutes }));
        const data = await apiRequest<{ entries: Array<{ date: string; meal: MealPlanEntry["meal"]; recipeId: string }> }>("/api/meal-plan/generate", {
          method: "POST", body: { householdId: ctx.householdId, ...opts, candidates }, timeoutMs: 45_000,
        });
        const entries = data.entries.map((entry) => {
          const recipe = recipes.find((r) => r.id === entry.recipeId);
          if (!recipe || !opts.dates.includes(entry.date) || !opts.meals.includes(entry.meal)) throw new Error("The generated plan included an invalid recipe or meal slot. Please retry.");
          return { date: entry.date, meal: entry.meal, recipe_id: entry.recipeId, recipe_name: recipe.name };
        });
        if (entries.length) await operation(ctx, "add-meal-plan-batch", { entries });
        return entries.length;
      },
      saveRecipe: async (recipe, ctx) => {
        const { data } = await apiRequest<{ data: SavedRecipeRow }>(resource(ctx, "saved-recipes"), { method: "POST", body: {
          name: recipe.name, description: recipe.description, cuisine: recipe.cuisine, minutes: recipe.minutes,
          difficulty: recipe.difficulty, servings: recipe.servings, equipment: recipe.equipment, ingredients: recipe.ingredients,
          steps: recipe.steps, tags: recipe.tags, external_id: recipe.externalId ?? null, image_url: recipe.imageUrl ?? null,
          area: recipe.area ?? null, source: recipe.source ?? null, video: recipe.video ?? null, calories: recipe.calories ?? null,
          protein_g: recipe.proteinG ?? null, carbs_g: recipe.carbsG ?? null, fat_g: recipe.fatG ?? null,
        } });
        const saved = savedRecipeFromRow(data);
        if (isCurrent(ctx)) get()._upsertSavedRecipe(saved);
        requestDataRefresh();
        return saved.id;
      },
      unsaveRecipe: async (savedId, ctx) => {
        await apiRequest(resource(ctx, "saved-recipes", savedId), { method: "DELETE" });
        if (isCurrent(ctx)) get()._removeSavedRecipe(`saved-${savedId}`);
        requestDataRefresh();
      },

      toggleEquipment: (name) =>
        set((s) => ({
          equipment: s.equipment.some((e) => e.name === name)
            ? s.equipment.filter((e) => e.name !== name)
            : [
                ...s.equipment,
                {
                  id: Math.random().toString(36).slice(2),
                  name,
                },
              ],
        })),
    }),
    {
      name: "pantry-pal-prefs",
      storage: createJSONStorage(() => localStorage),
      // Only persist local-only user prefs; household data remains authoritative in D1
      partialize: (state) => ({ equipment: state.equipment }),
    },
  ),
);

export function matchRecipeAgainstPantry(
  recipe: Recipe,
  pantry: PantryItem[],
  equipment: Equipment[],
): {
  score: number;
  have: number;
  total: number;
  canCook: boolean;
  equipmentOk: boolean;
} {
  const required = recipe.ingredients.filter((i) => !i.optional);
  const have = required.filter((ing) => {
    return availableQuantity(pantry, ing.name, ing.unit) >= ing.quantity;
  }).length;
  const equipmentOk = recipe.equipment.every((req) =>
    equipment.some((e) => e.name === req),
  );
  return {
    have,
    total: required.length,
    score: required.length === 0 ? 1 : have / required.length,
    canCook: have === required.length && equipmentOk,
    equipmentOk,
  };
}

// Sync layer -------------------------------------------------------
export {
  pantryFromRow,
  shoppingFromRow,
  mealPlanFromRow,
  usageFromRow,
  savedRecipeFromRow,
  type PantryRow,
  type ShoppingRow,
  type MealPlanRow,
  type UsageRow,
  type SavedRecipeRow,
};

export interface HouseholdSnapshot {
  pantry_items: PantryRow[];
  shopping_items: ShoppingRow[];
  meal_plan: MealPlanRow[];
  usage_events: UsageRow[];
  saved_recipes: SavedRecipeRow[];
  sequence: number;
  epoch: string;
}

let refreshOrder = 0;
export async function refreshHouseholdData(ctx: SyncedActionsCtx, signal?: AbortSignal) {
  const order = ++refreshOrder;
  const snapshot = await apiRequest<HouseholdSnapshot>(resource(ctx, "snapshot"), { signal });
  if (!isCurrent(ctx) || signal?.aborted || order !== refreshOrder) return;
  if (![snapshot.pantry_items, snapshot.shopping_items, snapshot.meal_plan, snapshot.usage_events, snapshot.saved_recipes].every(Array.isArray)) throw new Error("Invalid household response. Please retry.");
  useAppStore.setState({
    pantry: snapshot.pantry_items.map(pantryFromRow), shopping: snapshot.shopping_items.map(shoppingFromRow),
    mealPlan: snapshot.meal_plan.map(mealPlanFromRow), usage: snapshot.usage_events.map(usageFromRow),
    savedRecipes: snapshot.saved_recipes.map(savedRecipeFromRow), syncStatus: "online", syncError: null,
    lastSyncedAt: new Date().toISOString(),
  });
  const state = useAppStore.getState();
  void saveOfflineShopping({ schemaVersion: 1, userId: ctx.userId, householdId: ctx.householdId, householdName: ctx.householdName ?? "Your household", fetchedAt: state.lastSyncedAt!, items: state.shopping }).catch(() => {});
}
