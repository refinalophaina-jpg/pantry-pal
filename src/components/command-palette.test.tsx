import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./command-palette";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function openPalette() {
  act(() => {
    fireEvent.keyDown(document, { key: "k", metaKey: true });
  });
}

beforeEach(() => {
  push.mockReset();
  document.documentElement.removeAttribute("data-theme");
});

describe("CommandPalette", () => {
  it("is hidden until ⌘K, then opens", () => {
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    openPalette();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Go to Pantry")).toBeInTheDocument();
  });

  it("filters commands by query", async () => {
    render(<CommandPalette />);
    openPalette();
    await userEvent.type(screen.getByLabelText("Search commands"), "shopping");
    expect(screen.getByText("Go to Shopping")).toBeInTheDocument();
    expect(screen.queryByText("Go to Pantry")).not.toBeInTheDocument();
  });

  it("runs a command on click and navigates", async () => {
    render(<CommandPalette />);
    openPalette();
    await userEvent.click(screen.getByText("Go to Learn"));
    expect(push).toHaveBeenCalledWith("/learn");
    // closes after running
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keyboard: arrow-down then Enter runs the highlighted command", async () => {
    render(<CommandPalette />);
    openPalette();
    const input = screen.getByLabelText("Search commands");
    // first item is Dashboard (active 0); ArrowDown -> Pantry, Enter
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/pantry");
  });

  it("toggles the theme via the action command", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<CommandPalette />);
    openPalette();
    await userEvent.click(screen.getByText("Toggle light / dark theme"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("closes on Escape", () => {
    render(<CommandPalette />);
    openPalette();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
