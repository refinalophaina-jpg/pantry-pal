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
vi.mock("@/components/ingredient-autocomplete", () => ({ IngredientAutocomplete: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <input aria-label="Ingredient name" value={value} onChange={(event) => onChange(event.target.value)} />, pantryCategoryFor: () => "Other" }));
beforeEach(() => {
  mocks.add.mockReset().mockResolvedValue(undefined); mocks.update.mockReset().mockResolvedValue(undefined); mocks.toast.mockReset(); mocks.api.mockReset();
  useAppStore.setState({ pantry: [] });
});

it("preserves an add form after failure and closes only after a confirmed retry", async () => {
  mocks.add.mockRejectedValueOnce(new Error("offline"));
  render(<PantryPage />);
  await userEvent.click(screen.getAllByRole("button", { name: "Add item" })[0]);
  const dialog = screen.getByRole("dialog", { name: "Add pantry item" });
  await userEvent.type(within(dialog).getByLabelText("Ingredient name"), "Rice");
  await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("Couldn't add the item — try again.", "warn"));
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByLabelText("Ingredient name")).toHaveValue("Rice");
  let finish!: () => void;
  mocks.add.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  await userEvent.click(within(dialog).getByRole("button", { name: "Add" }));
  expect(within(dialog).getByRole("button", { name: "Adding…" })).toBeDisabled();
  await act(async () => { finish(); });
  expect(screen.queryByRole("dialog", { name: "Add pantry item" })).not.toBeInTheDocument();
});

it("keeps failed edits open and passes explicit blank expiry and notes", async () => {
  useAppStore.setState({ pantry: [{ id: "p1", name: "Rice", quantity: 2, unit: "cup", category: "Grains", zone: "pantry", addedOn: "2026-01-01", expiresOn: "2027-01-01", notes: "Keep dry" }] });
  mocks.update.mockRejectedValueOnce(new Error("offline"));
  render(<PantryPage />);
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  const dialog = screen.getByRole("dialog", { name: "Edit item" });
  await userEvent.clear(within(dialog).getByDisplayValue("2027-01-01"));
  await userEvent.clear(within(dialog).getByDisplayValue("Keep dry"));
  await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith("p1", expect.objectContaining({ expiresOn: "", notes: "" })));
  expect(dialog).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit item" })).not.toBeInTheDocument());
});

it("retries only the remaining photo items after a confirmed partial success", async () => {
  mocks.api.mockResolvedValue({ items: [{ name: "Milk", category: "Dairy" }, { name: "Eggs", category: "Protein" }] });
  mocks.add.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Temporary outage")).mockResolvedValueOnce(undefined);
  const view = render(<PantryPage />);
  await userEvent.click(screen.getByRole("button", { name: "Photo" }));
  const fileInput = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
  await userEvent.upload(fileInput, new File(["photo"], "groceries.jpg", { type: "image/jpeg" }));
  await screen.findByDisplayValue("Milk");
  await userEvent.click(screen.getByRole("button", { name: "Add 2 items" }));
  await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(2));
  expect(screen.queryByDisplayValue("Milk")).not.toBeInTheDocument();
  expect(screen.getByDisplayValue("Eggs")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Add 1 item" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Photo → ingredients" })).not.toBeInTheDocument());
  expect(mocks.add.mock.calls.map(([item]) => item.name)).toEqual(["Milk", "Eggs", "Eggs"]);
});
