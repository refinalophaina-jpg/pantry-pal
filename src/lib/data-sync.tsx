"use client";

import { ReactNode, useEffect } from "react";
import { useAppStore, identityKey, refreshHouseholdData } from "./store";
import { ApiError, invalidateApiRequests } from "./api-client";
import { useAuth } from "./auth-context";
import type { Recipe } from "./types";
import { readOfflineShopping, clearOfflineShopping } from "./offline-shopping";

/** Poll only while visible, and reconcile immediately after writes/resume. */
export function DataSync({ children }: { children: ReactNode }) {
  const { household, user, refreshHousehold } = useAuth();
  const userId = user?.id;
  const householdId = household?.id;
  const status = useAppStore((s) => s.syncStatus);
  const error = useAppStore((s) => s.syncError);
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);

  useEffect(() => {
    invalidateApiRequests();
    useAppStore.getState()._clearAllSynced();
    useAppStore.setState({ _identity: userId && householdId ? identityKey({ userId, householdId }) : null, syncStatus: "loading", syncError: null, lastSyncedAt: null });
    if (!userId || !householdId) return;
    const ctx = { userId, householdId, householdName: household?.name };
    let stopped = false;
    void readOfflineShopping().then((saved) => {
      if (!stopped && useAppStore.getState()._identity === identityKey(ctx) && saved && (saved.userId !== userId || saved.householdId !== householdId)) void clearOfflineShopping();
    }).catch(() => {});
    let running = false;
    let again = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const poll = async () => {
      if (stopped) return;
      if (running) { again = true; return; }
      clearTimeout(timer);
      if (document.visibilityState === "hidden") return;
      running = true;
      controller = new AbortController();
      try {
        await refreshHouseholdData(ctx, controller.signal);
        failures = 0;
      } catch (cause) {
        if (stopped || controller.signal.aborted) return;
        failures++;
        if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
          useAppStore.getState()._clearAllSynced();
          void clearOfflineShopping();
          useAppStore.setState({ syncStatus: "error", syncError: "Your access changed. Sign in or choose a household again." });
          void refreshHousehold();
        } else {
          useAppStore.setState({ syncStatus: navigator.onLine ? "error" : "offline", syncError: cause instanceof Error ? cause.message : "Could not refresh your household." });
        }
      } finally {
        running = false;
        if (!stopped) {
          const delay = again ? 0 : Math.min(60_000, 10_000 * 2 ** Math.min(failures, 3));
          again = false;
          timer = setTimeout(poll, delay);
        }
      }
    };
    const wake = () => { void poll(); };
    const offline = () => useAppStore.setState({ syncStatus: "offline", syncError: "You are offline. Changes need a connection." });
    window.addEventListener("online", wake);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", wake);
    window.addEventListener("pantry:data-refresh", wake);
    document.addEventListener("visibilitychange", wake);
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      invalidateApiRequests();
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pantry:data-refresh", wake);
      document.removeEventListener("visibilitychange", wake);
    };
    // Identity, rather than auth object/function identity, owns this lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, householdId]);

  return <>
    {(status === "error" || status === "offline") && <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
      {error} {lastSyncedAt && <>Last refreshed {new Date(lastSyncedAt).toLocaleTimeString()}.</>}
      <button className="ml-3 min-h-11 underline" onClick={() => window.dispatchEvent(new Event("pantry:data-refresh"))}>Retry refresh</button>
    </div>}
    {children}
  </>;
}

// Convenience: bound mutators for the current household + user
export function useSyncedActions() {
  const { household, user } = useAuth();
  const store = useAppStore();
  if (!household || !user) {
    throw new Error("useSyncedActions called without auth context");
  }
  const ctx = { householdId: household.id, userId: user.id, householdName: household.name };
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
    cookRecipe: (recipe: string | Recipe, servings?: number) => store.cookRecipe(recipe, ctx, servings),
    addShoppingItem: (item: Parameters<typeof store.addShoppingItem>[0]) =>
      store.addShoppingItem(item, ctx),
    toggleShoppingItem: (id: string) => store.toggleShoppingItem(id, ctx),
    removeShoppingItem: (id: string) => store.removeShoppingItem(id, ctx),
    clearCompleted: () => store.clearCompleted(ctx),
    generateFromRecipe: (recipe: string | Recipe, servings?: number) =>
      store.generateFromRecipe(recipe, ctx, servings),
    moveShoppingToPantry: (id: string) => store.moveShoppingToPantry(id, ctx),
    buildWeekList: (dates: string[]) => store.buildWeekList(dates, ctx),
    addMealPlan: (entry: Parameters<typeof store.addMealPlan>[0]) =>
      store.addMealPlan(entry, ctx),
    removeMealPlan: (id: string) => store.removeMealPlan(id, ctx),
    moveMealPlan: (
      id: string,
      target: Parameters<typeof store.moveMealPlan>[1],
    ) => store.moveMealPlan(id, target, ctx),
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
