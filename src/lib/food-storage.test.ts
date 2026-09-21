import { it, expect } from 'vitest';
import { foodStorage } from './food-storage';
it('separates perishable proteins and cooked food from cupboard staples',()=>{
  expect(foodStorage('Firm tofu').zone).toBe('fridge');
  expect(foodStorage('Cooked lentils').zone).toBe('fridge');
  expect(foodStorage('Dry lentils').zone).toBe('pantry');
  expect(foodStorage('Soy sauce').category).toContain('Cupboard');
  expect(foodStorage('Frozen spinach').zone).toBe('freezer');
});
