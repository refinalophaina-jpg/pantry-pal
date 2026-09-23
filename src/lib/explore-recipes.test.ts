import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bundledCards, cachedExploreCards, cardFromEntry, cuisineCounts, loadExploreCards, resolveCard, searchCards, uniqueCards } from './explore-recipes';
import type { CatalogEntry } from './catalog-index';

const mocks = vi.hoisted(() => ({ load: vi.fn(), cached: vi.fn(), fetchRecipe: vi.fn() }));
vi.mock('./catalog-index', () => ({ loadRecipeIndex: mocks.load, readCachedIndex: mocks.cached, fetchCatalogRecipe: mocks.fetchRecipe, clearRecipeIndexCache: vi.fn(), catalogEntryId: (entry: { slug: string }) => `cat-${entry.slug}` }));
const entry = (slug: string, name: string, cuisine = 'Vietnamese', ingredients = ['Rice noodles', 'Beef']): CatalogEntry => ({ slug, name, cuisine, minutes: 40, difficulty: 'medium', servings: 4, imageUrl: `https://www.themealdb.com/images/media/meals/${slug}.jpg`, source: 'themealdb', tags: ['Soup'], ingredients });
beforeEach(() => { vi.resetAllMocks(); mocks.cached.mockReturnValue(null); mocks.load.mockResolvedValue([]); });

describe('Explore from the shared catalog index', () => {
  it('merges bundled kitchen recipes with the index without fetching any recipe', async () => {
    mocks.load.mockResolvedValue([entry('mealdb-1', 'Pho'), entry('mealdb-2', 'Basil Thai Spaghetti', 'Thai')]);
    const { cards, notice } = await loadExploreCards();
    expect(notice).toBeUndefined();
    expect(cards.length).toBe(bundledCards().length + 1);
    const pho = cards.find(card => card.id === 'cat-mealdb-1')!;
    expect(pho).toMatchObject({ slug: 'mealdb-1', cuisine: 'Vietnamese', source: 'themealdb', ingredients: ['Rice noodles', 'Beef'] });
    expect(pho.recipe).toBeUndefined();
    // The bundled copy of a dish wins over the catalog's duplicate name.
    expect(cards.filter(card => card.name === 'Basil Thai Spaghetti')).toHaveLength(1);
    expect(mocks.fetchRecipe).not.toHaveBeenCalled();
  });

  it('keeps bundled recipes and explains when the catalog is unavailable, preferring a cached copy', async () => {
    mocks.load.mockRejectedValue(new Error('offline'));
    const first = await loadExploreCards();
    expect(first.cards.map(card => card.id)).toEqual(bundledCards().map(card => card.id));
    expect(first.notice).toContain('could not be loaded');
    mocks.cached.mockReturnValue([entry('mealdb-9', 'Bun cha')]);
    const second = await loadExploreCards();
    expect(second.cards.some(card => card.id === 'cat-mealdb-9')).toBe(true);
    expect(second.notice).toContain('last copy saved on this device');
    expect(cachedExploreCards().some(card => card.id === 'cat-mealdb-9')).toBe(true);
  });

  it('searches names, tags and ingredient names, filters by cuisine, and counts cuisines in the household order', () => {
    const catalog = [cardFromEntry(entry('mealdb-1', 'Pho')), cardFromEntry(entry('mealdb-3', 'Jollof rice', 'Nigerian', ['Rice', 'Tomato']))];
    const cards = uniqueCards([...bundledCards(), ...catalog]);
    expect(searchCards(cards, 'rice noodles').map(card => card.name)).toContain('Pho');
    expect(searchCards(catalog, 'noodles beef').map(card => card.name)).toEqual(['Pho']);
    expect(searchCards(cards, '', 'nigerian').map(card => card.name)).toContain('Jollof rice');
    expect(searchCards(cards, 'soup vietnamese').map(card => card.name)).toContain('Pho');
    expect(searchCards(catalog, 'soup vietnamese').map(card => card.name)).toEqual(['Pho']);
    const counts = cuisineCounts(cards);
    expect(counts[0].name).toBe('Vietnamese');
    expect(counts.find(item => item.name === 'Nigerian')).toEqual({ name: 'Nigerian', count: expect.any(Number) });
    expect(counts.some(item => item.name === 'International')).toBe(false);
  });

  it('resolves catalog cards by slug on open and bundled cards from memory', async () => {
    const full = { id: 'cat-mealdb-1', name: 'Pho', description: '', cuisine: 'Vietnamese', minutes: 40, difficulty: 'medium' as const, servings: 4, equipment: [], ingredients: [{ name: 'Beef', quantity: 1, unit: 'kg' as const }], steps: ['Simmer.'], tags: [] };
    mocks.fetchRecipe.mockResolvedValue(full);
    expect(await resolveCard(cardFromEntry(entry('mealdb-1', 'Pho')))).toEqual(full);
    expect(mocks.fetchRecipe).toHaveBeenCalledWith('mealdb-1');
    const bundled = bundledCards()[0];
    expect(await resolveCard(bundled)).toBe(bundled.recipe);
    mocks.fetchRecipe.mockResolvedValue(null);
    await expect(resolveCard(cardFromEntry(entry('gone', 'Gone')))).rejects.toThrow('no longer in the catalog');
  });
});
