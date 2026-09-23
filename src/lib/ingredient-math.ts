import { ingredientName } from "./ingredient-name";
import type { Recipe, UnitType } from "./types";

/** Pure quantity arithmetic shared by the store, the prep builder and matching. */
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

/** Combine repeated ingredients when their units convert; optional ones are left out. */
export function mergeIngredientNeeds(ingredients: Recipe["ingredients"]) {
  const combined: Recipe["ingredients"] = [];
  for (const ing of ingredients.filter((i) => !i.optional)) {
    const previous = combined.find((p) => ingredientName(p.name) === ingredientName(ing.name) && quantityInUnit(ing.quantity, ing.unit, p.unit) !== null);
    if (previous) previous.quantity += quantityInUnit(ing.quantity, ing.unit, previous.unit)!;
    else combined.push({ ...ing });
  }
  return combined;
}

export function scaledIngredients(recipe: Recipe, servings?: number) {
  const scale = (servings ?? recipe.servings) / Math.max(1, recipe.servings);
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("Choose a valid number of servings.");
  return mergeIngredientNeeds(recipe.ingredients.map((ing) => ({ ...ing, quantity: ing.quantity * scale })));
}

/** What still has to be bought after counting the pantry and the open shopping list. */
export function shortfall(needs: Recipe["ingredients"], pantry: Array<{ name: string; unit: UnitType; quantity: number }>, shopping: Array<{ name: string; unit: UnitType; quantity: number; done: boolean }>) {
  return needs.flatMap((item) => {
    const deficit = item.quantity - availableQuantity(pantry, item.name, item.unit) - availableQuantity(shopping.filter((s) => !s.done), item.name, item.unit);
    return deficit > 1e-8 ? [{ name: item.name, unit: item.unit, quantity: Math.max(0.001, Math.round(deficit * 1000) / 1000) }] : [];
  });
}
