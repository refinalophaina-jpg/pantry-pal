import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import OfflineShoppingPage from "./page";

const offline = vi.hoisted(() => ({ read: vi.fn(), clear: vi.fn() }));
vi.mock("@/lib/offline-shopping", () => ({ readOfflineShopping: offline.read, clearOfflineShopping: offline.clear, validateOfflineSnapshot: (value: unknown) => value }));
const snapshot = { schemaVersion: 1, userId: "u1", householdId: "h1", householdName: "Home", fetchedAt: new Date().toISOString(), items: [{ id: "s1", name: "Milk", quantity: 1, unit: "l", category: "Dairy", done: false }] };
beforeEach(() => { offline.read.mockReset().mockResolvedValue(snapshot); offline.clear.mockReset(); });

it("waits for durable deletion before displaying the completed empty state", async () => {
  let finish!: () => void;
  offline.clear.mockImplementation(() => {
    window.dispatchEvent(new Event("pantry:offline-cleared"));
    return new Promise<void>((resolve) => { finish = resolve; });
  });
  render(<OfflineShoppingPage />);
  await screen.findByText("Milk");
  await userEvent.click(screen.getByRole("button", { name: "Clear saved list" }));
  expect(screen.getByRole("status")).toHaveTextContent("Clearing saved list");
  expect(screen.queryByText(/No recent list is saved/)).not.toBeInTheDocument();
  await act(async () => { finish(); });
  expect(screen.getByText(/No recent list is saved/)).toBeInTheDocument();
});

it("does not render an old pending read after another tab clears the list", async () => {
  let finish!: (value: unknown) => void;
  offline.read.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<OfflineShoppingPage />);
  await act(async () => {
    window.dispatchEvent(new StorageEvent("storage", { key: "pantry-offline-cleared", newValue: String(Date.now()) }));
    finish(snapshot);
  });
  expect(screen.queryByText("Milk")).not.toBeInTheDocument();
  expect(screen.getByText(/No recent list is saved/)).toBeInTheDocument();
});
