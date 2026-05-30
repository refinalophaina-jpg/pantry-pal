"use client";

import { ReactNode, useEffect, useMemo } from "react";
import {
  useAppStore,
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
} from "./store";
import { getSupabase } from "./supabase";
import { useAuth } from "./auth-context";

export function DataSync({ children }: { children: ReactNode }) {
  const householdId = useAppStoreSelector();
  const { household, user } = useAuth();
  const supabase = getSupabase();
  const setPantry = useAppStore((s) => s._setPantry);
  const setShopping = useAppStore((s) => s._setShopping);
  const setMealPlan = useAppStore((s) => s._setMealPlan);
  const setUsage = useAppStore((s) => s._setUsage);
  const setSavedRecipes = useAppStore((s) => s._setSavedRecipes);
  const upsertPantry = useAppStore((s) => s._upsertPantry);
  const removePantry = useAppStore((s) => s._removePantry);
  const upsertShopping = useAppStore((s) => s._upsertShopping);
  const removeShopping = useAppStore((s) => s._removeShopping);
  const upsertMealPlan = useAppStore((s) => s._upsertMealPlan);
  const removeMealPlan = useAppStore((s) => s._removeMealPlan);
  const upsertUsage = useAppStore((s) => s._upsertUsage);
  const upsertSavedRecipe = useAppStore((s) => s._upsertSavedRecipe);
  const removeSavedRecipe = useAppStore((s) => s._removeSavedRecipe);
  const clearAll = useAppStore((s) => s._clearAllSynced);

  // Effective household id can come from auth or from local placeholder.
  const hid = household?.id ?? householdId;

  useEffect(() => {
    if (!hid || !user) {
      clearAll();
      return;
    }

    let cancelled = false;
    (async () => {
      const [p, s, m, u, r] = await Promise.all([
        supabase
          .from("pantry_items")
          .select("*")
          .eq("household_id", hid)
          .order("expires_on", { ascending: true, nullsFirst: false }),
        supabase
          .from("shopping_items")
          .select("*")
          .eq("household_id", hid)
          .order("created_at", { ascending: true }),
        supabase
          .from("meal_plan")
          .select("*")
          .eq("household_id", hid)
          .order("date", { ascending: true }),
        supabase
          .from("usage_events")
          .select("*")
          .eq("household_id", hid)
          .order("at", { ascending: false })
          .limit(200),
        supabase
          .from("saved_recipes")
          .select("*")
          .eq("household_id", hid)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      if (p.data) setPantry((p.data as PantryRow[]).map(pantryFromRow));
      if (s.data) setShopping((s.data as ShoppingRow[]).map(shoppingFromRow));
      if (m.data) setMealPlan((m.data as MealPlanRow[]).map(mealPlanFromRow));
      if (u.data) setUsage((u.data as UsageRow[]).map(usageFromRow));
      if (r.data)
        setSavedRecipes((r.data as SavedRecipeRow[]).map(savedRecipeFromRow));
    })();

    const channel = supabase
      .channel(`hh-${hid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pantry_items", filter: `household_id=eq.${hid}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            removePantry((payload.old as { id: string }).id);
          } else {
            upsertPantry(pantryFromRow(payload.new as PantryRow));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_items", filter: `household_id=eq.${hid}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            removeShopping((payload.old as { id: string }).id);
          } else {
            upsertShopping(shoppingFromRow(payload.new as ShoppingRow));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meal_plan", filter: `household_id=eq.${hid}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            removeMealPlan((payload.old as { id: string }).id);
          } else {
            upsertMealPlan(mealPlanFromRow(payload.new as MealPlanRow));
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "usage_events", filter: `household_id=eq.${hid}` },
        (payload) => upsertUsage(usageFromRow(payload.new as UsageRow)),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "saved_recipes", filter: `household_id=eq.${hid}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            removeSavedRecipe(`saved-${id}`);
          } else {
            upsertSavedRecipe(savedRecipeFromRow(payload.new as SavedRecipeRow));
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [
    hid,
    user,
    supabase,
    setPantry,
    setShopping,
    setMealPlan,
    setUsage,
    setSavedRecipes,
    upsertPantry,
    removePantry,
    upsertShopping,
    removeShopping,
    upsertMealPlan,
    removeMealPlan,
    upsertUsage,
    upsertSavedRecipe,
    removeSavedRecipe,
    clearAll,
  ]);

  return <>{children}</>;
}

// Internal placeholder to satisfy hook rules; we don't actually read state here.
function useAppStoreSelector() {
  return useMemo(() => "", []);
}

// Convenience: bound mutators for the current household + user
export function useSyncedActions() {
  const { household, user } = useAuth();
  const store = useAppStore();
  if (!household || !user) {
    throw new Error("useSyncedActions called without auth context");
  }
  const ctx = { householdId: household.id, userId: user.id };
  return {
    addPantryItem: (item: Parameters<typeof store.addPantryItem>[0]) =>
      store.addPantryItem(item, ctx),
    updatePantryItem: (
      id: string,
      patch: Parameters<typeof store.updatePantryItem>[1],
    ) => store.updatePantryItem(id, patch, ctx),
    removePantryItem: (id: string) => store.removePantryItem(id, ctx),
    consumeItem: (
      id: string,
      quantity: number,
      reason: "used" | "wasted",
    ) => store.consumeItem(id, quantity, reason, ctx),
    cookRecipe: (recipeId: string) => store.cookRecipe(recipeId, ctx),
    addShoppingItem: (item: Parameters<typeof store.addShoppingItem>[0]) =>
      store.addShoppingItem(item, ctx),
    toggleShoppingItem: (id: string) => store.toggleShoppingItem(id, ctx),
    removeShoppingItem: (id: string) => store.removeShoppingItem(id, ctx),
    clearCompleted: () => store.clearCompleted(ctx),
    generateFromRecipe: (recipeId: string) =>
      store.generateFromRecipe(recipeId, ctx),
    buildWeekList: (dates: string[]) => store.buildWeekList(dates, ctx),
    addMealPlan: (entry: Parameters<typeof store.addMealPlan>[0]) =>
      store.addMealPlan(entry, ctx),
    removeMealPlan: (id: string) => store.removeMealPlan(id, ctx),
    generateMealPlan: (opts: {
      dates: string[];
      meals: string[];
      preferences: string;
    }) => store.generateMealPlan(opts, ctx),
    saveRecipe: (recipe: Parameters<typeof store.saveRecipe>[0]) =>
      store.saveRecipe(recipe, ctx),
    unsaveRecipe: (savedId: string) => store.unsaveRecipe(savedId, ctx),
    toggleEquipment: store.toggleEquipment,
  };
}
