import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders the title and optional subtitle", () => {
    render(<PageHeader title="Pantry" subtitle="What you have" />);
    expect(screen.getByRole("heading", { name: "Pantry" })).toBeInTheDocument();
    expect(screen.getByText("What you have")).toBeInTheDocument();
  });

  it("renders actions when provided", () => {
    render(<PageHeader title="Recipes" actions={<button>Add</button>} />);
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("omits the subtitle when not given", () => {
    const { container } = render(<PageHeader title="Bare" />);
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });
});
