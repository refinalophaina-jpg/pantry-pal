import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LearnPage from "./page";
import { listTechniques, type Technique } from "@/lib/food-db";

vi.mock("@/lib/food-db", () => ({ listTechniques: vi.fn() }));
const mockedList = vi.mocked(listTechniques);

function tech(p: Partial<Technique>): Technique {
  return {
    id: p.slug ?? "t",
    slug: p.slug ?? "t",
    title: p.title ?? "Title",
    category: p.category ?? "General",
    difficulty: p.difficulty ?? "easy",
    minutes: p.minutes,
    summary: p.summary ?? "",
    body: p.body ?? "",
    tags: p.tags ?? [],
  };
}

beforeEach(() => {
  mockedList.mockReset();
  mockedList.mockResolvedValue([]); // safe default; tests override as needed
});

describe("LearnPage", () => {
  it("loads techniques, groups them, and expands a guide on click", async () => {
    mockedList.mockResolvedValue([
      tech({
        slug: "searing",
        title: "Searing",
        category: "Heat & Protein",
        difficulty: "medium",
        minutes: 15,
        summary: "Brown protein in a hot pan.",
        body: "1. Pat dry.\n2. **Do not move it** until a crust forms.",
      }),
      tech({
        slug: "blanching",
        title: "Blanching",
        category: "Vegetables",
        summary: "Boil then ice-shock.",
        body: "Quick dip, then ice.",
      }),
    ]);

    render(<LearnPage />);

    expect(await screen.findByText("Searing")).toBeInTheDocument();
    expect(screen.getByText("Heat & Protein")).toBeInTheDocument();
    expect(screen.getByText("Vegetables")).toBeInTheDocument();

    // Body hidden until the card is opened.
    expect(screen.queryByText(/Pat dry/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Searing"));
    expect(screen.getByText(/Pat dry/)).toBeInTheDocument();
    // **bold** renders as <strong>
    expect(screen.getByText("Do not move it").tagName).toBe("STRONG");
  });

  it("filters by the search box", async () => {
    mockedList.mockResolvedValue([
      tech({ slug: "searing", title: "Searing", category: "Heat & Protein" }),
      tech({ slug: "blanching", title: "Blanching", category: "Vegetables" }),
    ]);
    render(<LearnPage />);
    await screen.findByText("Searing");

    await userEvent.type(
      screen.getByPlaceholderText("Search techniques…"),
      "blanch",
    );
    expect(screen.getByText("Blanching")).toBeInTheDocument();
    expect(screen.queryByText("Searing")).not.toBeInTheDocument();
  });

  it("surfaces a load error", async () => {
    mockedList.mockRejectedValue(new Error("offline"));
    render(<LearnPage />);
    await waitFor(
      () => expect(screen.queryByText("offline")).not.toBeNull(),
      { timeout: 2000 },
    );
  });
});
