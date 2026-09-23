import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import PantryPage from "./page";
import { useAppStore } from "@/lib/store";

const mocks = vi.hoisted(() => ({ add: vi.fn(), update: vi.fn(), toast: vi.fn(), api: vi.fn() }));
vi.mock("@/lib/data-sync", () => ({ useSyncedActions: () => ({ addPantryItem: mocks.add, updatePantryItem: mocks.update, removePantryItem: vi.fn(), consumeItem: vi.fn() }) }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ household: { id: "h1" } }) }));
vi.mock("@/components/toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/lib/api-client", async (original) => ({ ...await original<typeof import("@/lib/api-client")>(), apiRequest: mocks.api }));
vi.mock("@/lib/nutrition", () => ({ lookupNutrition: async () => ({ calories: 130, proteinG: 2.7, carbsG: 28 }) }));
beforeEach(() => {
  mocks.add.mockReset().mockResolvedValue(undefined); mocks.update.mockReset().mockResolvedValue(undefined); mocks.toast.mockReset(); mocks.api.mockReset();
  useAppStore.setState({ pantry: [], usage: [] });
});

it("adds several typed items in one go, keeps the unsaved rows after a failure, and closes on success", async () => {
  mocks.add.mockRejectedValueOnce(new Error("offline"));
  render(<PantryPage />);
  await userEvent.click(screen.getAllByRole("button", { name: "Add items" })[0]);
  const dialog = screen.getByRole("dialog", { name: "Add to pantry" });
  await userEvent.type(within(dialog).getByLabelText("Items, one per line or separated by commas"), "2 kg rice, 6 eggs (fridge)");
  expect(within(dialog).getByText("Rice")).toBeInTheDocument();
  expect(within(dialog).getByLabelText("Zone for Eggs")).toHaveValue("fridge");
  await userEvent.click(within(dialog).getByRole("button", { name: "Add 2 items" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("offline", "warn"));
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Add 2 items" })).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Add 2 items" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add to pantry" })).not.toBeInTheDocument());
  expect(mocks.add.mock.calls.map(([item]) => item)).toEqual([
    expect.objectContaining({ name: "Rice", quantity: 2, unit: "kg", zone: "pantry", category: "Grains" }),
    expect.objectContaining({ name: "Rice", quantity: 2, unit: "kg" }),
    expect.objectContaining({ name: "Eggs", quantity: 6, unit: "pcs", zone: "fridge", category: "Protein" }),
  ]);
  expect(mocks.toast).toHaveBeenLastCalledWith("2 items added.");
});

it("opens an item sheet with storage guidance and nutrition, keeps failed edits open, and passes explicit blank expiry and notes", async () => {
  useAppStore.setState({ pantry: [{ id: "p1", name: "Rice", quantity: 2, unit: "cup", category: "Grains", zone: "pantry", addedOn: "2026-01-01", expiresOn: "2027-01-01", notes: "Keep dry" }] });
  mocks.update.mockRejectedValueOnce(new Error("offline"));
  render(<PantryPage />);
  await userEvent.click(screen.getByRole("button", { name: "Details for Rice" }));
  const dialog = screen.getByRole("dialog", { name: "Rice" });
  expect(within(dialog).getByText(/White rice, dry/)).toBeInTheDocument();
  expect(await within(dialog).findByText("130")).toBeInTheDocument();
  await userEvent.clear(within(dialog).getByDisplayValue("2027-01-01"));
  await userEvent.clear(within(dialog).getByDisplayValue("Keep dry"));
  await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("p1", expect.objectContaining({ expiresOn: "", notes: "" })));
  expect(dialog).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Rice" })).not.toBeInTheDocument());
});

it("asks before marking an item wasted and offers a date from the storage guidance", async () => {
  useAppStore.setState({ pantry: [{ id: "p1", name: "Spinach", quantity: 1, unit: "pcs", category: "Produce", zone: "fridge", addedOn: "2026-01-01" }] });
  render(<PantryPage />);
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  const dialog = screen.getByRole("dialog", { name: "Spinach" });
  expect(within(dialog).getByText(/Leafy greens/)).toBeInTheDocument();
  await userEvent.click(within(dialog).getAllByRole("button", { name: "set date" })[0]);
  expect((within(dialog).getByLabelText("Expires on") as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await userEvent.click(within(dialog).getByRole("button", { name: "Mark wasted" }));
  expect(within(dialog).getByText(/Mark all 1 pcs wasted\?/)).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Keep" }));
  expect(within(dialog).queryByText(/Mark all 1 pcs wasted\?/)).not.toBeInTheDocument();
});

it("retries only the remaining photo items after a confirmed partial success", async () => {
  mocks.api.mockResolvedValue({ items: [{ name: "Milk", category: "Dairy & Eggs" }, { name: "Eggs", category: "Dairy & Eggs" }] });
  mocks.add.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Temporary outage")).mockResolvedValueOnce(undefined);
  const view = render(<PantryPage />);
  await userEvent.click(screen.getByRole("button", { name: "Photo" }));
  const fileInput = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
  await userEvent.upload(fileInput, new File(["photo"], "groceries.jpg", { type: "image/jpeg" }));
  await screen.findByDisplayValue("Milk");
  expect(screen.getByLabelText("Zone for Milk")).toHaveValue("fridge");
  await userEvent.click(screen.getByRole("button", { name: "Add 2 items" }));
  await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(2));
  expect(screen.queryByDisplayValue("Milk")).not.toBeInTheDocument();
  expect(screen.getByDisplayValue("Eggs")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Add 1 item" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add to pantry" })).not.toBeInTheDocument());
  expect(mocks.add.mock.calls.map(([item]) => item.name)).toEqual(["Milk", "Eggs", "Eggs"]);
  expect(mocks.add.mock.calls[0][0]).toMatchObject({ category: "Dairy", zone: "fridge" });
});
