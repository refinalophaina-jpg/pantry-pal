import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecipeDetail } from "./recipe-detail";
import { ToastProvider } from "./toast";
import { useAppStore } from "@/lib/store";
import type { Recipe } from "@/lib/types";

const { saveRecipe, unsaveRecipe, generateFromRecipe } = vi.hoisted(() => ({
  saveRecipe: vi.fn(),
  unsaveRecipe: vi.fn(),
  generateFromRecipe: vi.fn(),
}));
vi.mock("@/lib/data-sync", () => ({
  useSyncedActions: () => ({ saveRecipe, unsaveRecipe, generateFromRecipe }),
}));
vi.mock("@/lib/nutrition", () => ({
  estimateRecipeNutrition: vi.fn().mockResolvedValue({
    calories: 0,
    perServing: { calories: 130, proteinG: 5, carbsG: 20, fatG: 3 },
    knownIngredients: 2,
    totalIngredients: 2,
  }),
}));

const recipe: Recipe = {
  id: "r1",
  name: "Pho",
  description: "Vietnamese noodle soup.",
  cuisine: "Vietnamese",
  minutes: 40,
  difficulty: "medium",
  servings: 4,
  equipment: [],
  ingredients: [
    { name: "noodles", quantity: 200, unit: "g" },
    { name: "beef", quantity: 300, unit: "g" },
  ],
  steps: ["Boil broth.", "Assemble."],
  tags: ["soup"],
  calories: 520,
  proteinG: 30,
  carbsG: 60,
  fatG: 12,
};

function renderDetail(props: Partial<Parameters<typeof RecipeDetail>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <RecipeDetail recipe={recipe} onClose={onClose} {...props} />
    </ToastProvider>,
  );
  return { onClose };
}

beforeEach(() => {
  saveRecipe.mockReset();
  unsaveRecipe.mockReset();
  generateFromRecipe.mockReset();
  // pantry covers noodles but not beef -> 1 / 2
  useAppStore.setState({
    pantry: [
      {
        id: "p1",
        name: "noodles",
        category: "Grains",
        quantity: 500,
        unit: "g",
        zone: "pantry",
        addedOn: "2026-06-01",
      },
    ],
    savedRecipes: [],
  });
});

describe("RecipeDetail", () => {
  it("renders the recipe, its calories, and pantry availability", () => {
    renderDetail();
    expect(screen.getByText("Pho")).toBeInTheDocument();
    expect(screen.getAllByText(/520 kcal/).length).toBeGreaterThan(0);
    expect(screen.getByText("1 / 2")).toBeInTheDocument(); // have noodles, not beef
    expect(screen.getByText("noodles")).toBeInTheDocument();
    expect(screen.getByText("beef")).toBeInTheDocument();
  });

  it("saves an unsaved recipe", async () => {
    saveRecipe.mockResolvedValue("saved-x");
    renderDetail();
    await userEvent.click(
      screen.getByRole("button", { name: /save to my recipes/i }),
    );
    expect(saveRecipe).toHaveBeenCalledWith(recipe);
    expect(await screen.findByText(/Pho saved/)).toBeInTheDocument();
  });

  it("shows Saved + unsaves when already in the collection", async () => {
    useAppStore.setState({
      savedRecipes: [{ ...recipe, id: "saved-9", savedId: "9" }],
    });
    unsaveRecipe.mockResolvedValue(undefined);
    renderDetail();
    const btn = screen.getByRole("button", { name: /saved/i });
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(unsaveRecipe).toHaveBeenCalledWith("9");
  });

  it("adds missing ingredients to the shopping list", async () => {
    generateFromRecipe.mockResolvedValue(undefined);
    renderDetail();
    await userEvent.click(
      screen.getByRole("button", { name: /add missing to list/i }),
    );
    expect(generateFromRecipe).toHaveBeenCalledWith("r1");
    expect(await screen.findByText(/added to shopping list/i)).toBeInTheDocument();
  });

  it("shows Cook now only when onCook is provided and calls it", async () => {
    const onCook = vi.fn();
    renderDetail({ onCook });
    await userEvent.click(screen.getByRole("button", { name: /cook now/i }));
    expect(onCook).toHaveBeenCalledOnce();
  });

  it("scales ingredient amounts with the servings stepper", async () => {
    renderDetail();
    expect(screen.getByText("200 g")).toBeInTheDocument();
    expect(screen.getByText("300 g")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /more servings/i }));
    // 5/4 = 1.25 → 250 / 375
    expect(screen.getByText("250 g")).toBeInTheDocument();
    expect(screen.getByText("375 g")).toBeInTheDocument();

    // back down to 3 servings → 0.75 → 150 / 225
    await userEvent.click(screen.getByRole("button", { name: /fewer servings/i }));
    await userEvent.click(screen.getByRole("button", { name: /fewer servings/i }));
    expect(screen.getByText("150 g")).toBeInTheDocument();
    expect(screen.getByText("225 g")).toBeInTheDocument();
  });

  it("won't drop below 1 serving", async () => {
    renderDetail();
    const fewer = screen.getByRole("button", { name: /fewer servings/i });
    // base is 4; click down past 1
    for (let i = 0; i < 6; i++) await userEvent.click(fewer);
    expect(fewer).toBeDisabled();
    // 1/4 = 0.25 → noodles 50 g
    expect(screen.getByText("50 g")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const { onClose } = renderDetail();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
