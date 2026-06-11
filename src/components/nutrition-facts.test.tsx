import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NutritionFacts } from "./nutrition-facts";

describe("NutritionFacts", () => {
  it("renders the present facts and skips missing ones", () => {
    render(
      <NutritionFacts
        nutrition={{ calories: 539, fatG: 30.9, sugarsG: 56.3 }}
        servingSize="15 g"
      />,
    );
    expect(screen.getByText("Calories")).toBeInTheDocument();
    expect(screen.getByText(/539/)).toBeInTheDocument();
    expect(screen.getByText("Sugars")).toBeInTheDocument();
    expect(screen.queryByText("Protein")).not.toBeInTheDocument();
    expect(screen.queryByText("Sodium")).not.toBeInTheDocument();
    expect(screen.getByText(/serving 15 g/)).toBeInTheDocument();
  });

  it("shows zero values rather than dropping them", () => {
    render(<NutritionFacts nutrition={{ calories: 0, fiberG: 0 }} />);
    expect(screen.getByText("Calories")).toBeInTheDocument();
    expect(screen.getByText("Fiber")).toBeInTheDocument();
  });

  it("shows the Nutri-Score chip only when a grade exists", () => {
    const { rerender } = render(
      <NutritionFacts nutrition={{ calories: 100 }} nutriScore="e" />,
    );
    expect(screen.getByTitle("Nutri-Score E")).toBeInTheDocument();
    rerender(<NutritionFacts nutrition={{ calories: 100 }} />);
    expect(screen.queryByTitle(/Nutri-Score/)).not.toBeInTheDocument();
  });

  it("is an accessible labelled region", () => {
    render(<NutritionFacts nutrition={{ calories: 250 }} />);
    expect(
      screen.getByRole("region", { name: "Nutrition facts" }),
    ).toBeInTheDocument();
  });
});
