import { describe, it, expect } from 'vitest';
import { prepDates, prepPortion, prepBatch } from './prep-planner';
import { prepRecipes } from './prep-recipes';
import foodReference from './food-reference.json';
describe('three-day prep quantities', () => {
  it('scales one calendar meal, so three entries equal one batch for the household', () => {
    const recipe=prepRecipes[0]; const portion=prepPortion(recipe,2);
    expect(portion.servings).toBe(2);
    expect(portion.ingredients[0].quantity*3).toBe(recipe.ingredients[0].quantity*2);
    expect(recipe.servings).toBe(3);
    expect(()=>prepPortion(recipe,0)).toThrow();
    expect(()=>prepPortion(recipe,1.5)).toThrow();
  });
  it('crosses month/year boundaries without timezone drift and rejects impossible dates',()=>{
    expect(prepDates('2026-12-31')).toEqual(['2026-12-31','2027-01-01','2027-01-02']);
    expect(()=>prepDates('2026-02-30')).toThrow();
  });
  it('ships exact source identifiers with finite nutrient records',()=>{
    expect(new Set(foodReference.map(f=>f.id)).size).toBe(32);
    for(const food of foodReference){expect(food.sourceUrl).toContain(food.id);expect(food.description).toBeTruthy();expect(food.calories).toBeGreaterThanOrEqual(0);}
  });
});

it('opens the full three-day cooking batch while scaling water and keeping cooking times',()=>{
  const recipe = prepRecipes[1]; const batch = prepBatch(recipe,2);
  expect(batch.servings).toBe(6);
  expect(batch.ingredients[0].quantity).toBe(480);
  expect(batch.steps.join(' ')).toContain('1600 ml water');
  expect(batch.steps.join(' ')).toContain('25–35 minutes');
  expect(batch.steps.join(' ')).toContain('6 shallow containers');
});
