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
import { seedRecipes, seedEquipment, seedDeals } from "./seed-data";
import { getSupabase } from "./supabase";

interface SyncedActionsCtx {
  householdId: string;
  userId: string;
}

interface AppState {
  // Synced from Supabase
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

  // Mutators (these write through to Supabase when ctx is set)
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
    recipeId: string,
    ctx: SyncedActionsCtx,
  ) => Promise<{ ok: boolean; missing: string[] }>;

  addShoppingItem: (
    item: Omit<ShoppingItem, "id" | "done">,
    ctx: SyncedActionsCtx,
  ) => Promise<void>;
  toggleShoppingItem: (id: string, ctx: SyncedActionsCtx) => Promise<void>;
  removeShoppingItem: (id: string, ctx: SyncedActionsCtx) => Promise<void>;
  clearCompleted: (ctx: SyncedActionsCtx) => Promise<void>;
  generateFromRecipe: (recipeId: string, ctx: SyncedActionsCtx) => Promise<void>;
  buildWeekList: (dates: string[], ctx: SyncedActionsCtx) => Promise<number>;

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

const supa = () => getSupabase();

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
  done: boolean;
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
    done: row.done,
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
      _clearAllSynced: () =>
        set({
          pantry: [],
          shopping: [],
          mealPlan: [],
          usage: [],
          savedRecipes: [],
        }),

      addPantryItem: async (item, ctx) => {
        const { data, error } = await supa()
          .from("pantry_items")
          .insert({
            household_id: ctx.householdId,
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
            zone: item.zone,
            expires_on: item.expiresOn ?? null,
            notes: item.notes ?? null,
            created_by: ctx.userId,
          })
          .select()
          .single();
        if (error || !data) throw error ?? new Error("Insert failed");
        get()._upsertPantry(pantryFromRow(data as PantryRow));
      },

      updatePantryItem: async (id, patch, ctx) => {
        const dbPatch: Record<string, unknown> = {};
        if (patch.name !== undefined) dbPatch.name = patch.name;
        if (patch.category !== undefined) dbPatch.category = patch.category;
        if (patch.quantity !== undefined) dbPatch.quantity = patch.quantity;
        if (patch.unit !== undefined) dbPatch.unit = patch.unit;
        if (patch.zone !== undefined) dbPatch.zone = patch.zone;
        if (patch.expiresOn !== undefined)
          dbPatch.expires_on = patch.expiresOn ?? null;
        if (patch.notes !== undefined) dbPatch.notes = patch.notes ?? null;
        const { data, error } = await supa()
          .from("pantry_items")
          .update(dbPatch)
          .eq("id", id)
          .eq("household_id", ctx.householdId)
          .select()
          .single();
        if (error || !data) throw error ?? new Error("Update failed");
        get()._upsertPantry(pantryFromRow(data as PantryRow));
      },

      removePantryItem: async (id, ctx) => {
        const { error } = await supa()
          .from("pantry_items")
          .delete()
          .eq("id", id)
          .eq("household_id", ctx.householdId);
        if (error) throw error;
        get()._removePantry(id);
      },

      consumeItem: async (id, quantity, reason, ctx) => {
        const item = get().pantry.find((p) => p.id === id);
        if (!item) return;
        const newQty = Math.max(0, item.quantity - quantity);
        if (newQty === 0) {
          await get().removePantryItem(id, ctx);
        } else {
          await get().updatePantryItem(id, { quantity: newQty }, ctx);
        }
        const { data, error } = await supa()
          .from("usage_events")
          .insert({
            household_id: ctx.householdId,
            item_id: item.id,
            item_name: item.name,
            quantity,
            unit: item.unit,
            reason,
            created_by: ctx.userId,
          })
          .select()
          .single();
        if (error || !data) throw error ?? new Error("Usage insert failed");
        get()._upsertUsage(usageFromRow(data as UsageRow));
      },

      cookRecipe: async (recipeId, ctx) => {
        const recipe = get().recipes.find((r) => r.id === recipeId);
        if (!recipe) return { ok: false, missing: [] };
        const pantry = get().pantry;
        const required = recipe.ingredients.filter((i) => !i.optional);
        const missing = required.filter((ing) => {
          const owned = pantry.find(
            (p) => p.name.toLowerCase() === ing.name.toLowerCase(),
          );
          return !owned || owned.quantity < ing.quantity;
        });
        if (missing.length > 0)
          return { ok: false, missing: missing.map((m) => m.name) };

        for (const ing of required) {
          const item = pantry.find(
            (p) => p.name.toLowerCase() === ing.name.toLowerCase(),
          );
          if (!item) continue;
          await get().consumeItem(item.id, ing.quantity, "used", ctx);
        }
        return { ok: true, missing: [] };
      },

      addShoppingItem: async (item, ctx) => {
        const { data, error } = await supa()
          .from("shopping_items")
          .insert({
            household_id: ctx.householdId,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category,
            from_recipe: item.fromRecipe ?? null,
            deal_price: item.dealPrice ?? null,
            deal_store: item.dealStore ?? null,
            created_by: ctx.userId,
          })
          .select()
          .single();
        if (error || !data) throw error ?? new Error("Shopping insert failed");
        get()._upsertShopping(shoppingFromRow(data as ShoppingRow));
      },

      toggleShoppingItem: async (id, ctx) => {
        const item = get().shopping.find((s) => s.id === id);
        if (!item) return;
        const { data, error } = await supa()
          .from("shopping_items")
          .update({ done: !item.done })
          .eq("id", id)
          .eq("household_id", ctx.householdId)
          .select()
          .single();
        if (error || !data) throw error ?? new Error("Toggle failed");
        get()._upsertShopping(shoppingFromRow(data as ShoppingRow));
      },

      removeShoppingItem: async (id, ctx) => {
        const { error } = await supa()
          .from("shopping_items")
          .delete()
          .eq("id", id)
          .eq("household_id", ctx.householdId);
        if (error) throw error;
        get()._removeShopping(id);
      },

      clearCompleted: async (ctx) => {
        const done = get().shopping.filter((s) => s.done);
        if (done.length === 0) return;
        const { error } = await supa()
          .from("shopping_items")
          .delete()
          .in(
            "id",
            done.map((d) => d.id),
          )
          .eq("household_id", ctx.householdId);
        if (error) throw error;
        done.forEach((d) => get()._removeShopping(d.id));
      },

      generateFromRecipe: async (recipeId, ctx) => {
        const recipe = get().recipes.find((r) => r.id === recipeId);
        if (!recipe) return;
        const pantry = get().pantry;
        const missing = recipe.ingredients.filter((ing) => {
          if (ing.optional) return false;
          const have = pantry.find(
            (p) => p.name.toLowerCase() === ing.name.toLowerCase(),
          );
          return !have || have.quantity < ing.quantity;
        });
        for (const m of missing) {
          await get().addShoppingItem(
            {
              name: m.name,
              quantity: m.quantity,
              unit: m.unit,
              category: "From recipe",
              fromRecipe: recipe.name,
            },
            ctx,
          );
        }
      },

      // Build a shopping list for a set of dates: sum every planned recipe's
      // non-optional ingredients, subtract what's already in the pantry (by
      // name + unit) and what's already on the list, and add the remainder.
      // Returns how many items were added.
      buildWeekList: async (dates, ctx) => {
        const { mealPlan, recipes, savedRecipes, pantry, shopping } = get();
        const all = [...savedRecipes, ...recipes];
        const planned = mealPlan.filter((m) => dates.includes(m.date));

        const need = new Map<
          string,
          { name: string; quantity: number; unit: UnitType; recipe: string }
        >();
        for (const entry of planned) {
          const r = all.find((x) => x.id === entry.recipeId);
          if (!r) continue;
          for (const ing of r.ingredients) {
            if (ing.optional) continue;
            const key = `${ing.name.toLowerCase()}|${ing.unit}`;
            const prev = need.get(key);
            if (prev) prev.quantity += ing.quantity;
            else
              need.set(key, {
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
                recipe: r.name,
              });
          }
        }

        const onList = new Set(shopping.map((s) => s.name.toLowerCase()));
        let added = 0;
        for (const item of need.values()) {
          const owned = pantry.find(
            (p) =>
              p.name.toLowerCase() === item.name.toLowerCase() &&
              p.unit === item.unit,
          );
          const deficit = owned ? item.quantity - owned.quantity : item.quantity;
          if (deficit <= 0) continue; // already have enough
          if (onList.has(item.name.toLowerCase())) continue; // avoid dupes
          await get().addShoppingItem(
            {
              name: item.name,
              quantity: Math.ceil(deficit),
              unit: item.unit,
              category: "This week",
              fromRecipe: item.recipe,
            },
            ctx,
          );
          onList.add(item.name.toLowerCase());
          added++;
        }
        return added;
      },

      addMealPlan: async (entry, ctx) => {
        const recipe = get().recipes.find((r) => r.id === entry.recipeId);
        const { data, error } = await supa()
          .from("meal_plan")
          .insert({
            household_id: ctx.householdId,
            date: entry.date,
            meal: entry.meal,
            recipe_id: entry.recipeId,
            recipe_name: recipe?.name ?? null,
            created_by: ctx.userId,
          })
          .select()
          .single();
        if (error || !data) throw error ?? new Error("Meal plan insert failed");
        get()._upsertMealPlan(mealPlanFromRow(data as MealPlanRow));
      },

      removeMealPlan: async (id, ctx) => {
        const { error } = await supa()
          .from("meal_plan")
          .delete()
          .eq("id", id)
          .eq("household_id", ctx.householdId);
        if (error) throw error;
        get()._removeMealPlan(id);
      },

      moveMealPlan: async (id, target, ctx) => {
        const existing = get().mealPlan.find((m) => m.id === id);
        if (!existing) return;
        // No-op if dropped on its own slot.
        if (existing.date === target.date && existing.meal === target.meal) {
          return;
        }
        // Optimistic move; reconcile from the DB row (or revert on failure).
        get()._upsertMealPlan({ ...existing, ...target });
        const { data, error } = await supa()
          .from("meal_plan")
          .update({ date: target.date, meal: target.meal })
          .eq("id", id)
          .eq("household_id", ctx.householdId)
          .select()
          .single();
        if (error || !data) {
          get()._upsertMealPlan(existing); // revert
          throw error ?? new Error("Meal plan move failed");
        }
        get()._upsertMealPlan(mealPlanFromRow(data as MealPlanRow));
      },

      // Ask Claude (server-side, capped) to assign known recipes across the given
      // dates/meals, then persist the returned entries. Returns how many landed.
      generateMealPlan: async (opts, ctx) => {
        const { recipes, savedRecipes } = get();
        const candidates = [...savedRecipes, ...recipes].map((r) => ({
          id: r.id,
          name: r.name,
          cuisine: r.cuisine,
          tags: r.tags,
          minutes: r.minutes,
        }));
        const { data, error } = await supa().functions.invoke(
          "generate-meal-plan",
          {
            body: {
              householdId: ctx.householdId,
              dates: opts.dates,
              meals: opts.meals,
              preferences: opts.preferences,
              candidates,
            },
          },
        );
        if (error) throw new Error(error.message || "Generation failed.");
        if (data?.error) throw new Error(data.error);
        const entries = (data?.entries ?? []) as Array<{
          date: string;
          meal: MealPlanEntry["meal"];
          recipeId: string;
        }>;
        for (const e of entries) {
          await get().addMealPlan(
            { date: e.date, meal: e.meal, recipeId: e.recipeId },
            ctx,
          );
        }
        return entries.length;
      },

      saveRecipe: async (recipe, ctx) => {
        const { data, error } = await supa()
          .from("saved_recipes")
          .insert({
            household_id: ctx.householdId,
            name: recipe.name,
            description: recipe.description,
            cuisine: recipe.cuisine,
            minutes: recipe.minutes,
            difficulty: recipe.difficulty,
            servings: recipe.servings,
            equipment: recipe.equipment,
            ingredients: recipe.ingredients,
            steps: recipe.steps,
            tags: recipe.tags,
            external_id: recipe.externalId ?? null,
            image_url: recipe.imageUrl ?? null,
            area: recipe.area ?? null,
            source: recipe.source ?? null,
            video: recipe.video ?? null,
            calories: recipe.calories ?? null,
            protein_g: recipe.proteinG ?? null,
            carbs_g: recipe.carbsG ?? null,
            fat_g: recipe.fatG ?? null,
            created_by: ctx.userId,
          })
          .select()
          .single();
        if (error || !data) throw error ?? new Error("Save failed");
        const saved = savedRecipeFromRow(data as SavedRecipeRow);
        get()._upsertSavedRecipe(saved);
        return saved.id;
      },

      unsaveRecipe: async (savedId, ctx) => {
        const { error } = await supa()
          .from("saved_recipes")
          .delete()
          .eq("id", savedId)
          .eq("household_id", ctx.householdId);
        if (error) throw error;
        get()._removeSavedRecipe(savedId);
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
      // Only persist local-only user prefs; everything else lives in Supabase
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
    const match = pantry.find(
      (p) => p.name.toLowerCase() === ing.name.toLowerCase(),
    );
    return match && match.quantity >= ing.quantity;
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
