import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bundledExploreRecipes, loadExploreRecipes, clearExploreCache } from './explore-recipes';
import type { Recipe } from './types';

const mocks = vi.hoisted(() => ({ catalog: vi.fn(), filter: vi.fn(), lookup: vi.fn(), random: vi.fn(), search: vi.fn() }));
vi.mock('./food-db', () => ({ searchRecipeCatalog: mocks.catalog }));
vi.mock('./mealdb', () => ({ filterByArea: mocks.filter, lookupMeal: mocks.lookup, randomMeals: mocks.random, searchByName: mocks.search }));
const recipe = (id: string, name = id, cuisine = 'Italian'): Recipe => ({ id, name, cuisine, description: '', minutes: 20, difficulty: 'easy', servings: 2, equipment: [], ingredients: [{ name: 'Rice', quantity: 0.5, unit: 'cup' }], steps: ['Cook the rice.'], tags: [] });
beforeEach(() => { clearExploreCache(); vi.resetAllMocks(); mocks.catalog.mockResolvedValue([]); mocks.random.mockResolvedValue([]); mocks.search.mockResolvedValue([]); });

describe('zero-secret Explore sources', () => {
  it('loads Discover from D1 and bundled recipes without a world or paid-provider call', async () => {
    mocks.catalog.mockResolvedValue([recipe('cat-special', 'Kitchen special')]);
    const result = await loadExploreRecipes('discover');
    expect(result.recipes[0].id).toBe('cat-special');
    expect(result.recipes.length).toBeGreaterThan(1);
    expect(result.notice).toBeUndefined();
    expect(mocks.catalog).toHaveBeenCalledWith('', 100);
    expect(mocks.random).not.toHaveBeenCalled();
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it('keeps usable recipes and a visible notice when D1 or the world provider fails', async () => {
    mocks.catalog.mockRejectedValue(new Error('API unavailable'));
    mocks.random.mockRejectedValue(new Error('World unavailable'));
    const result = await loadExploreRecipes('world');
    expect(result.recipes.map(item => item.id)).toEqual(bundledExploreRecipes().map(item => item.id));
    expect(result.notice).toContain('Our Kitchen could not be refreshed');
    expect(result.notice).toContain('World recipes are temporarily unavailable');
  });

  it('maps cuisine cards through full detail lookup, retains save/cook fields, and reports missing details', async () => {
    mocks.filter.mockResolvedValue([{ idMeal: '10' }, { idMeal: '11' }]);
    const full = { ...recipe('mealdb-10', 'World rice', 'Japanese'), externalId: '10', source: 'https://example.test/recipe' };
    mocks.lookup.mockImplementation((id: string) => id === '10' ? Promise.resolve(full) : Promise.reject(new Error('Missing')));
    const result = await loadExploreRecipes('Japanese');
    expect(mocks.filter).toHaveBeenCalledWith('Japanese');
    expect(mocks.lookup).toHaveBeenCalledTimes(2);
    expect(result.recipes.find(item => item.id === 'mealdb-10')).toEqual(full);
    expect(result.notice).toContain('Some World recipes');
    expect(result.recipes.every(item => item.cuisine === 'Japanese')).toBe(true);
  });

  it('keeps local cuisine filtering accurate when external browsing fails', async () => {
    mocks.catalog.mockResolvedValue([recipe('cat-italian'), recipe('cat-french', 'French meal', 'French')]);
    mocks.filter.mockRejectedValue(new Error('Unavailable'));
    const result = await loadExploreRecipes('French');
    expect(result.recipes.some(item => item.id === 'cat-french')).toBe(true);
    expect(result.recipes.every(item => item.cuisine === 'French')).toBe(true);
    expect(result.notice).toContain('World recipes are temporarily unavailable');
  });

  it('combines search, deduplicates names, and removes non-URL catalog provenance links', async () => {
    mocks.catalog.mockResolvedValue([{ ...recipe('cat-rice', 'Special rice'), source: 'curated' }]);
    mocks.search.mockResolvedValue([recipe('mealdb-12', 'Special rice'), recipe('mealdb-13', 'Different rice')]);
    const result = await loadExploreRecipes('discover', 'Special rice');
    expect(mocks.search).toHaveBeenCalledWith('Special rice');
    expect(result.recipes.filter(item => item.name === 'Special rice')).toHaveLength(1);
    expect(result.recipes.find(item => item.id === 'cat-rice')!.source).toBeUndefined();
    expect(result.recipes.some(item => item.id === 'mealdb-13')).toBe(true);
  });
});

it('reuses bounded public catalog results between page visits', async () => {
  const first = await loadExploreRecipes('kitchen');
  const second = await loadExploreRecipes('kitchen');
  expect(second).toBe(first);
  expect(mocks.catalog).toHaveBeenCalledTimes(1);
});
