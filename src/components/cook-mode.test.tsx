import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookMode } from "./cook-mode";
import { ToastProvider } from "./toast";
import type { Recipe } from "@/lib/types";

const { cookRecipe } = vi.hoisted(() => ({ cookRecipe: vi.fn() }));
vi.mock("@/lib/data-sync", () => ({
  useSyncedActions: () => ({ cookRecipe }),
}));

const recipe: Recipe = {
  id: "r1",
  name: "Boiled Pasta",
  description: "",
  cuisine: "Italian",
  minutes: 15,
  difficulty: "easy",
  servings: 2,
  equipment: [],
  ingredients: [
    { name: "pasta", quantity: 200, unit: "g" },
    { name: "garnish", quantity: 1, unit: "pcs", optional: true },
  ],
  steps: ["Boil water.", "Add pasta."],
  tags: [],
};

function renderCook(onClose = vi.fn()) {
  render(
    <ToastProvider>
      <CookMode recipe={recipe} onClose={onClose} />
    </ToastProvider>,
  );
  return onClose;
}

beforeEach(() => cookRecipe.mockReset());

describe("CookMode", () => {
  it("shows the first step and the (required-only) deduction list", () => {
    renderCook();
    expect(screen.getByText("Boil water.")).toBeInTheDocument();
    expect(screen.getByText("Step 1 / 2")).toBeInTheDocument();
    expect(screen.getByText("pasta")).toBeInTheDocument();
    expect(screen.getByText("−200g")).toBeInTheDocument();
    expect(screen.queryByText("garnish")).not.toBeInTheDocument(); // optional
  });

  it("navigates between steps (Back disabled at the start)", async () => {
    renderCook();
    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("Add pasta.")).toBeInTheDocument();
    expect(screen.getByText("Step 2 / 2")).toBeInTheDocument();
  });

  it("blocks finishing until every step is marked done, then cooks", async () => {
    const onClose = renderCook();
    cookRecipe.mockResolvedValue({ ok: true, missing: [] });

    // step 1 -> mark done -> next -> mark done
    await userEvent.click(screen.getByRole("button", { name: /mark done/i }));
    await userEvent.click(screen.getByRole("button", { name: /next/i }));

    const finishBtn = screen.getByRole("button", { name: /i cooked this/i });
    expect(finishBtn).toBeDisabled(); // step 2 not done yet
    await userEvent.click(screen.getByRole("button", { name: /mark done/i }));
    expect(finishBtn).toBeEnabled();

    await userEvent.click(finishBtn);
    expect(cookRecipe).toHaveBeenCalledWith("r1");
    expect(await screen.findByText(/cooked — pantry updated/i)).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it("warns about missing ingredients and stays open", async () => {
    const onClose = renderCook();
    cookRecipe.mockResolvedValue({ ok: false, missing: ["pasta"] });

    await userEvent.click(screen.getByRole("button", { name: /mark done/i }));
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await userEvent.click(screen.getByRole("button", { name: /mark done/i }));
    await userEvent.click(screen.getByRole("button", { name: /i cooked this/i }));

    expect(await screen.findByText(/Missing: pasta/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("exits via the close button", async () => {
    const onClose = renderCook();
    await userEvent.click(screen.getByRole("button", { name: /exit cook mode/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
