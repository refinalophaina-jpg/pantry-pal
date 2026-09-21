import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExplorePage from './page';
import type { Recipe } from '@/lib/types';

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
const local: Recipe = { id: 'local-rice', name: 'Local rice', description: '', cuisine: 'Italian', minutes: 20, difficulty: 'easy', servings: 2, equipment: [], ingredients: [{ name: 'Rice', quantity: 1, unit: 'cup' }], steps: ['Cook rice.'], tags: [] };
vi.mock('@/lib/explore-recipes', () => ({ bundledExploreRecipes: () => [local], EXPLORE_CUISINES: ['Italian', 'Japanese'], loadExploreRecipes: mocks.load, shuffledRecipes: (recipes: Recipe[]) => recipes }));
vi.mock('@/components/recipe-detail', () => ({ RecipeDetail: ({ recipe, onCook }: { recipe: Recipe; onCook: (recipe: Recipe) => void }) => <button onClick={() => onCook(recipe)}>Cook {recipe.name}</button> }));
vi.mock('@/components/cook-mode', () => ({ CookMode: ({ recipe }: { recipe: Recipe }) => <div>Cooking {recipe.name}: {recipe.ingredients[0].quantity} {recipe.ingredients[0].unit}</div> }));
beforeEach(() => { mocks.load.mockReset(); mocks.load.mockResolvedValue({ recipes: [local] }); });

describe('Explore page', () => {
  it('shows bundled cards immediately, refreshes Discover again, and keeps the detail/cook route', async () => {
    render(<ExplorePage />);
    expect(screen.getByRole('button', { name: /Local rice/ })).toBeInTheDocument();
    await waitFor(() => expect(mocks.load).toHaveBeenCalledWith('discover', ''));
    fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }));
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: /Local rice/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cook Local rice' }));
    expect(screen.getByText('Cooking Local rice: 1 cup')).toBeInTheDocument();
  });

  it('shows a world-provider failure beside usable local results', async () => {
    render(<ExplorePage />);
    await waitFor(() => expect(screen.queryByText('Refreshing recipes…')).not.toBeInTheDocument());
    mocks.load.mockResolvedValueOnce({ recipes: [local], notice: 'World recipes are temporarily unavailable.' });
    fireEvent.click(screen.getByRole('button', { name: 'World recipes' }));
    expect(await screen.findByRole('status')).toHaveTextContent('World recipes are temporarily unavailable.');
    expect(screen.getByRole('button', { name: /Local rice/ })).toBeInTheDocument();
  });

  it('ignores a stale response after the user changes cuisine', async () => {
    let finishOld!: (value: { recipes: Recipe[] }) => void;
    mocks.load.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
    render(<ExplorePage />);
    const japanese = { ...local, id: 'world-sushi', name: 'Sushi', cuisine: 'Japanese' };
    mocks.load.mockResolvedValueOnce({ recipes: [japanese] });
    fireEvent.click(screen.getByRole('button', { name: 'Japanese' }));
    expect(await screen.findByRole('button', { name: /Sushi/ })).toBeInTheDocument();
    await act(async () => { finishOld({ recipes: [local] }); });
    expect(screen.getByRole('button', { name: /Sushi/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Local rice/ })).not.toBeInTheDocument();
  });
});
