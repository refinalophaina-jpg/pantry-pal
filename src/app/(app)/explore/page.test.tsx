import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExplorePage from './page';
import { useAppStore } from '@/lib/store';
import type { Recipe } from '@/lib/types';

const mocks = vi.hoisted(() => ({ load: vi.fn(), draft: vi.fn() }));
const local: Recipe = { id: 'local-rice', name: 'Local rice', description: '', cuisine: 'Italian', minutes: 20, difficulty: 'easy', servings: 2, equipment: [], ingredients: [{ name: 'Rice', quantity: 1, unit: 'cup' }, { name: 'Spinach', quantity: 100, unit: 'g' }, { name: 'Chicken breast', quantity: 200, unit: 'g' }], steps: ['Cook rice.'], tags: [] };
const localCard = { id: local.id, name: local.name, cuisine: local.cuisine, minutes: local.minutes, difficulty: local.difficulty, servings: 2, source: 'kitchen', tags: [], ingredients: ['Rice', 'Spinach', 'Chicken breast'], recipe: local };
const catalogCard = { id: 'cat-mealdb-1', slug: 'mealdb-1', name: 'Pho', cuisine: 'Vietnamese', minutes: 90, difficulty: 'medium' as const, servings: 4, source: 'themealdb', tags: ['Soup'], ingredients: ['Beef bones', 'Rice noodles', 'Onion'] };
vi.mock('@/lib/explore-recipes', async (original) => ({ ...await original<typeof import('@/lib/explore-recipes')>(), cachedExploreCards: () => [localCard], loadExploreCards: mocks.load, shuffledCards: <T,>(items: T[]) => items }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ household: { id: 'h1' } }) }));
vi.mock('@/lib/recipe-ai', () => ({ draftDishes: mocks.draft }));
vi.mock('@/lib/data-sync', () => ({ useSyncedActions: () => ({}) }));
vi.mock('@/components/toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/recipe-detail', () => ({ RecipeDetail: ({ recipe, note, onCook }: { recipe: Recipe; note?: string; onCook: (recipe: Recipe) => void }) => <div role="dialog" aria-label={recipe.name}>{note && <p>{note}</p>}<button onClick={() => onCook(recipe)}>Cook {recipe.name}</button></div> }));
vi.mock('@/components/cook-mode', () => ({ CookMode: ({ recipe }: { recipe: Recipe }) => <div>Cooking {recipe.name}: {recipe.ingredients[0].quantity} {recipe.ingredients[0].unit}</div> }));
vi.mock('@/components/recipe-editor', () => ({ RecipeEditor: () => null }));
beforeEach(() => {
  mocks.load.mockReset().mockResolvedValue({ cards: [localCard, catalogCard] });
  mocks.draft.mockReset();
  useAppStore.setState({ pantry: [], _identity: 'u:h1' });
});

describe('Explore page', () => {
  it('shows cached cards at once, loads the catalog index, and opens a card into cooking', async () => {
    render(<ExplorePage />);
    expect(screen.getByRole('button', { name: /Local rice/ })).toBeInTheDocument();
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: /Pho/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Vietnamese/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Local rice/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cook Local rice' }));
    expect(screen.getByText('Cooking Local rice: 1 cup')).toBeInTheDocument();
  });

  it('keeps cards and explains when the catalog cannot be loaded', async () => {
    mocks.load.mockResolvedValue({ cards: [localCard], notice: 'The shared catalog could not be loaded. Bundled kitchen recipes are shown.' });
    render(<ExplorePage />);
    expect(await screen.findByRole('status')).toHaveTextContent('could not be loaded');
    expect(screen.getByRole('button', { name: /Local rice/ })).toBeInTheDocument();
  });

  it('ranks dishes by pantry coverage and filters to them', async () => {
    useAppStore.setState({ pantry: [{ id: 'p1', name: 'Rice', quantity: 1, unit: 'kg', category: 'Grains', zone: 'pantry', addedOn: '2026-01-01' }, { id: 'p2', name: 'Baby spinach', quantity: 200, unit: 'g', category: 'Produce', zone: 'fridge', addedOn: '2026-01-01' }] });
    render(<ExplorePage />);
    await screen.findByRole('button', { name: /Pho/ });
    const section = screen.getByRole('region', { name: 'Cook from what you have' });
    expect(within(section).getByRole('button', { name: /Local rice/ })).toHaveTextContent('2 of 3 in your pantry');
    expect(within(section).queryByRole('button', { name: /Pho/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'From my pantry' }));
    expect(screen.getByRole('heading', { level: 2, name: /1 dish you can mostly cook now/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pho/ })).not.toBeInTheDocument();
  });

  it('drafts dishes from the pantry and shows why each one fits', async () => {
    useAppStore.setState({ pantry: [{ id: 'p1', name: 'Eggs', quantity: 6, unit: 'pcs', category: 'Protein', zone: 'fridge', addedOn: '2026-01-01' }] });
    mocks.draft.mockResolvedValue([{ recipe: { ...local, id: 'ai-1', name: 'Egg fried rice', tags: ['drafted'] }, why: 'Uses the eggs before they turn.', fromPantry: ['Eggs'] }]);
    render(<ExplorePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Draft from my pantry' }));
    const dialog = screen.getByRole('dialog', { name: 'Draft dishes from your pantry' });
    fireEvent.change(within(dialog).getByLabelText('In the mood for (optional)'), { target: { value: 'quick' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Draft dishes' }));
    await waitFor(() => expect(mocks.draft).toHaveBeenCalledWith('h1', { brief: 'quick', cuisine: '', count: 3, focus: [] }));
    const drafts = await screen.findByRole('region', { name: 'Drafted from your pantry' });
    expect(within(drafts).getByRole('button', { name: /Egg fried rice/ })).toHaveTextContent('Uses the eggs before they turn.');
    fireEvent.click(within(drafts).getByRole('button', { name: /Egg fried rice/ }));
    expect(await screen.findByRole('dialog', { name: 'Egg fried rice' })).toHaveTextContent('Uses the eggs before they turn.');
  });
});
