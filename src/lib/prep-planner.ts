import type { Recipe } from './types';
/** A calendar entry represents one meal for the household, not the entire batch. */
export function prepPortion(recipe: Recipe, people: number): Recipe {
  if (!Number.isInteger(people) || people < 1 || people > 12) throw new Error('Choose 1–12 people.');
  return { ...recipe, id: `${recipe.id}-${people}p`, externalId: `${recipe.id}-${people}p`, name: `${recipe.name} · ${people} ${people === 1 ? 'portion' : 'portions'}`, servings: people,
    ingredients: recipe.ingredients.map(ing => ({ ...ing, quantity: ing.quantity * people / recipe.servings })),
    steps: scaledPrepSteps(recipe, people),
    description: `${recipe.description} Calendar quantities cover one meal for ${people}; cook three times these quantities for the full three-day batch.` };
}
export function prepDates(start: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error('Choose a valid start date.');
  const day = new Date(`${start}T12:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== start) throw new Error('Choose a valid start date.');
  return Array.from({ length: 3 }, (_, offset) => new Date(day.getTime() + offset * 86400000).toISOString().slice(0, 10));
}

function scaledPrepSteps(recipe: Recipe, servings: number): string[] {
  const factor = servings / recipe.servings;
  return recipe.steps.map(step => step
    .replace(/\b(\d+) ml water/g, (_, quantity) => `${Math.round(Number(quantity) * factor)} ml water`)
    .replace(/\b(\d+) tablespoons water/g, (_, quantity) => `${Math.round(Number(quantity) * factor * 10) / 10} tablespoons water`)
    .replace(/\bthree\b/g, String(servings))
    .replace(/\b(\d+) g cooked quinoa/g, (_, quantity) => `${Math.round(Number(quantity) * factor)} g cooked quinoa`));
}
/** Full batch shown from the prep page; calendar entries use prepPortion instead. */
export function prepBatch(recipe: Recipe, people: number): Recipe {
  prepPortion(recipe, people); // validates household size
  const servings = people * 3;
  return { ...recipe, servings,
    ingredients: recipe.ingredients.map(ing => ({ ...ing, quantity: ing.quantity * servings / recipe.servings })),
    steps: scaledPrepSteps(recipe, servings),
    description: `${recipe.description} Full three-day batch: ${servings} portions for ${people} ${people === 1 ? 'person' : 'people'}.` };
}
