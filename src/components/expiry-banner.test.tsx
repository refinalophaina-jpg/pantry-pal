import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExpiryBanner } from "./expiry-banner";
import { useAppStore } from "@/lib/store";
import type { PantryItem } from "@/lib/types";

function item(over: Partial<PantryItem>): PantryItem {
  return {
    id: Math.random().toString(36).slice(2),
    name: "Thing",
    category: "Other",
    quantity: 1,
    unit: "pcs",
    zone: "fridge",
    addedOn: "2026-05-01",
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 2, 12, 0, 0)); // 2026-06-02 noon local
  localStorage.clear();
  useAppStore.setState({ pantry: [] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("ExpiryBanner", () => {
  it("renders nothing when no item is within a day of expiry", () => {
    useAppStore.setState({
      pantry: [item({ name: "Rice", expiresOn: "2026-06-20" })],
    });
    const { container } = render(<ExpiryBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("warns about items expiring today, tomorrow, or already expired", () => {
    useAppStore.setState({
      pantry: [
        item({ name: "Milk", expiresOn: "2026-06-02" }), // today
        item({ name: "Spinach", expiresOn: "2026-06-03" }), // in 1d
        item({ name: "Yogurt", expiresOn: "2026-06-01" }), // 1d ago
        item({ name: "Pasta", expiresOn: "2026-07-01" }), // safe, excluded
      ],
    });
    render(<ExpiryBanner />);
    expect(screen.getByText("3 items need attention")).toBeInTheDocument();
    expect(screen.getByText(/Milk \(expires today\)/)).toBeInTheDocument();
    expect(screen.getByText(/Spinach \(expires in 1d\)/)).toBeInTheDocument();
    expect(screen.getByText(/Yogurt \(expired 1d ago\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Pasta/)).not.toBeInTheDocument();
  });

  it("can be dismissed and stays dismissed for the day", () => {
    useAppStore.setState({
      pantry: [item({ name: "Milk", expiresOn: "2026-06-02" })],
    });
    render(<ExpiryBanner />);
    expect(screen.getByText("1 item needs attention")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(screen.queryByText("1 item needs attention")).not.toBeInTheDocument();
    expect(localStorage.getItem("pantry-pal-expiry-dismissed")).toBe(
      new Date().toDateString(),
    );
  });
});
