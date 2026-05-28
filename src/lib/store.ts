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
} from "./types";
import {
  seedPantry,
  seedRecipes,
  seedEquipment,
  seedDeals,
  seedUsage,
} from "./seed-data";
import { uid } from "./utils";

interface AppState {
  pantry: PantryItem[];
  recipes: Recipe[];
  shopping: ShoppingItem[];
  mealPlan: MealPlanEntry[];
  usage: UsageEvent[];
  equipment: Equipment[];
  deals: StoreDeal[];

  addPantryItem: (item: Omit<PantryItem, "id" | "addedOn">) => void;
  updatePantryItem: (id: string, patch: Partial<PantryItem>) => void;
  removePantryItem: (id: string) => void;
  consumeItem: (id: string, quantity: number, reason: "used" | "wasted") => void;

  addShoppingItem: (item: Omit<ShoppingItem, "id" | "done">) => void;
  toggleShoppingItem: (id: string) => void;
  removeShoppingItem: (id: string) => void;
  clearCompleted: () => void;
  generateFromRecipe: (recipeId: string) => void;

  addMealPlan: (entry: Omit<MealPlanEntry, "id">) => void;
  removeMealPlan: (id: string) => void;

  cookRecipe: (recipeId: string) => { ok: boolean; missing: string[] };

  toggleEquipment: (name: string) => void;
  resetAll: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      pantry: seedPantry,
      recipes: seedRecipes,
      shopping: [],
      mealPlan: [],
      usage: seedUsage,
      equipment: seedEquipment,
      deals: seedDeals,

      addPantryItem: (item) =>
        set((s) => ({
          pantry: [
            ...s.pantry,
            { ...item, id: uid(), addedOn: new Date().toISOString().slice(0, 10) },
          ],
        })),

      updatePantryItem: (id, patch) =>
        set((s) => ({
          pantry: s.pantry.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      removePantryItem: (id) =>
        set((s) => ({ pantry: s.pantry.filter((p) => p.id !== id) })),

      consumeItem: (id, quantity, reason) => {
        const item = get().pantry.find((p) => p.id === id);
        if (!item) return;
        const newQty = Math.max(0, item.quantity - quantity);
        set((s) => ({
          pantry:
            newQty === 0
              ? s.pantry.filter((p) => p.id !== id)
              : s.pantry.map((p) =>
                  p.id === id ? { ...p, quantity: newQty } : p,
                ),
          usage: [
            ...s.usage,
            {
              id: uid(),
              itemId: item.id,
              itemName: item.name,
              quantity,
              unit: item.unit,
              reason,
              at: new Date().toISOString(),
            },
          ],
        }));
      },

      addShoppingItem: (item) =>
        set((s) => ({
          shopping: [...s.shopping, { ...item, id: uid(), done: false }],
        })),

      toggleShoppingItem: (id) =>
        set((s) => ({
          shopping: s.shopping.map((p) =>
            p.id === id ? { ...p, done: !p.done } : p,
          ),
        })),

      removeShoppingItem: (id) =>
        set((s) => ({ shopping: s.shopping.filter((p) => p.id !== id) })),

      clearCompleted: () =>
        set((s) => ({ shopping: s.shopping.filter((p) => !p.done) })),

      generateFromRecipe: (recipeId) => {
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
        set((s) => ({
          shopping: [
            ...s.shopping,
            ...missing.map((m) => ({
              id: uid(),
              name: m.name,
              quantity: m.quantity,
              unit: m.unit,
              category: "From recipe",
              done: false,
              fromRecipe: recipe.name,
            })),
          ],
        }));
      },

      addMealPlan: (entry) =>
        set((s) => ({
          mealPlan: [...s.mealPlan, { ...entry, id: uid() }],
        })),

      removeMealPlan: (id) =>
        set((s) => ({ mealPlan: s.mealPlan.filter((m) => m.id !== id) })),

      cookRecipe: (recipeId) => {
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
        if (missing.length > 0) {
          return { ok: false, missing: missing.map((m) => m.name) };
        }
        const now = new Date().toISOString();
        let newPantry = pantry;
        const newEvents: UsageEvent[] = [];
        for (const ing of required) {
          const item = newPantry.find(
            (p) => p.name.toLowerCase() === ing.name.toLowerCase(),
          )!;
          const remaining = item.quantity - ing.quantity;
          newPantry =
            remaining <= 0
              ? newPantry.filter((p) => p.id !== item.id)
              : newPantry.map((p) =>
                  p.id === item.id ? { ...p, quantity: remaining } : p,
                );
          newEvents.push({
            id: uid(),
            itemId: item.id,
            itemName: item.name,
            quantity: ing.quantity,
            unit: ing.unit,
            reason: "used",
            at: now,
          });
        }
        set((s) => ({
          pantry: newPantry,
          usage: [...s.usage, ...newEvents],
        }));
        return { ok: true, missing: [] };
      },

      toggleEquipment: (name) =>
        set((s) => ({
          equipment: s.equipment.some((e) => e.name === name)
            ? s.equipment.filter((e) => e.name !== name)
            : [...s.equipment, { id: uid(), name }],
        })),

      resetAll: () =>
        set({
          pantry: seedPantry,
          recipes: seedRecipes,
          shopping: [],
          mealPlan: [],
          usage: [],
          equipment: seedEquipment,
          deals: seedDeals,
        }),
    }),
    {
      name: "pantry-pal-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function matchRecipeAgainstPantry(
  recipe: Recipe,
  pantry: PantryItem[],
  equipment: Equipment[],
): { score: number; have: number; total: number; canCook: boolean; equipmentOk: boolean } {
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
