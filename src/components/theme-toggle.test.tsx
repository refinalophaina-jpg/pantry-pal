import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ThemeToggle,
  applyTheme,
  currentTheme,
} from "./theme-toggle";

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

describe("applyTheme / currentTheme", () => {
  it("defaults to light when nothing is set", () => {
    expect(currentTheme()).toBe("light");
  });

  it("applies the theme to <html> and persists it", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(currentTheme()).toBe("dark");
    expect(localStorage.getItem("pantry-pal-theme")).toBe("dark");
  });
});

describe("ThemeToggle", () => {
  it("toggles between dark and light and persists the choice", async () => {
    applyTheme("light");
    render(<ThemeToggle />);

    // Mounted in light mode -> invites switching to dark.
    const btn = screen.getByRole("button", { name: /switch to dark mode/i });
    await userEvent.click(btn);

    expect(currentTheme()).toBe("dark");
    expect(localStorage.getItem("pantry-pal-theme")).toBe("dark");
    expect(
      screen.getByRole("button", { name: /switch to light mode/i }),
    ).toBeInTheDocument();

    // Toggle back.
    await userEvent.click(
      screen.getByRole("button", { name: /switch to light mode/i }),
    );
    expect(currentTheme()).toBe("light");
  });

  it("reflects an already-dark document on mount", async () => {
    applyTheme("dark");
    render(<ThemeToggle />);
    expect(
      await screen.findByRole("button", { name: /switch to light mode/i }),
    ).toBeInTheDocument();
  });
});
