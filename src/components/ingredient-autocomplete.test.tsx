import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  IngredientAutocomplete,
  pantryCategoryFor,
} from "./ingredient-autocomplete";
import { searchIngredients, type Ingredient } from "@/lib/food-db";

vi.mock("@/lib/food-db", () => ({ searchIngredients: vi.fn() }));
const mockedSearch = vi.mocked(searchIngredients);

function ing(name: string, category: string): Ingredient {
  return {
    id: name,
    slug: name.toLowerCase(),
    name,
    category,
    aliases: [],
    source: "curated",
  };
}

beforeEach(() => {
  mockedSearch.mockReset();
});

describe("pantryCategoryFor", () => {
  it("maps consortium categories onto pantry buckets", () => {
    expect(pantryCategoryFor("Meat & Seafood")).toBe("Protein");
    expect(pantryCategoryFor("Dairy & Eggs")).toBe("Dairy");
    expect(pantryCategoryFor("Oils & Condiments")).toBe("Oils");
  });
  it("falls back to Other for unknown categories", () => {
    expect(pantryCategoryFor("Martian Cuisine")).toBe("Other");
  });
});

function Harness({ onSelect }: { onSelect?: (i: Ingredient) => void }) {
  const [v, setV] = useState("");
  return (
    <IngredientAutocomplete
      value={v}
      onChange={setV}
      onSelect={onSelect}
      placeholder="name"
    />
  );
}

describe("IngredientAutocomplete", () => {
  it("does not search for queries shorter than 2 chars", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByPlaceholderText("name"), "t");
    // give the debounce a chance
    await new Promise((r) => setTimeout(r, 250));
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("shows suggestions and selecting one fills name + fires onSelect", async () => {
    mockedSearch.mockResolvedValue([
      ing("Tomato", "Produce"),
      ing("Tofu", "Legumes & Nuts"),
    ]);
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);

    await userEvent.type(screen.getByPlaceholderText("name"), "to");

    const option = await screen.findByRole("option", { name: /Tomato/ });
    expect(option).toBeInTheDocument();
    expect(mockedSearch).toHaveBeenCalledWith("to", 8);

    await userEvent.click(option);

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect.mock.calls[0][0].name).toBe("Tomato");
    expect(screen.getByPlaceholderText("name")).toHaveValue("Tomato");
    // list closes after choosing
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
  });

  it("fails soft when the search throws (no crash, no list)", async () => {
    mockedSearch.mockRejectedValue(new Error("offline"));
    render(<Harness />);
    await userEvent.type(screen.getByPlaceholderText("name"), "milk");
    await waitFor(() => expect(mockedSearch).toHaveBeenCalled());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
