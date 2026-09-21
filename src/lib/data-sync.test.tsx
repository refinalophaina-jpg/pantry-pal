import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor, cleanup } from "@testing-library/react";
import { DataSync } from "./data-sync";
import { useAppStore } from "./store";
const h = vi.hoisted(() => ({ user: { id: "u1" } as { id: string } | null, household: { id: "h1", name: "Home" } as { id: string; name: string } | null, refresh: vi.fn() }));
const offline = vi.hoisted(() => ({ read: vi.fn(), clear: vi.fn(), save: vi.fn() }));
vi.mock("./auth-context", () => ({ useAuth: () => ({ user: h.user, household: h.household, refreshHousehold: h.refresh }) }));
vi.mock("./offline-shopping", () => ({ readOfflineShopping: offline.read, clearOfflineShopping: offline.clear, saveOfflineShopping: offline.save }));
const fetchMock = vi.fn();
const empty = { pantry_items: [], shopping_items: [], meal_plan: [], usage_events: [], saved_recipes: [], sequence: 1, epoch: "1" };
const rice = { id: "p1", household_id: "h1", name: "Rice", category: "Grains", quantity: 2, unit: "cup", zone: "pantry", expires_on: null, added_on: "2026-06-01", notes: null };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
beforeEach(() => {
  h.user = { id: "u1" }; h.household = { id: "h1", name: "Home" }; h.refresh.mockReset();
  offline.read.mockReset().mockResolvedValue(null); offline.clear.mockReset().mockResolvedValue(undefined); offline.save.mockReset().mockResolvedValue(undefined);
  fetchMock.mockReset().mockImplementation(async () => json(empty));
  vi.stubGlobal("fetch", fetchMock);
  useAppStore.setState({ pantry: [], shopping: [], mealPlan: [], usage: [], savedRecipes: [], _identity: null });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("DataSync polling and identity", () => {
  it("loads an authenticated snapshot and renders children", async () => {
    fetchMock.mockResolvedValueOnce(json({ ...empty, pantry_items: [rice] }));
    const view = render(<DataSync><div>child</div></DataSync>);
    await waitFor(() => expect(useAppStore.getState().pantry[0]?.name).toBe("Rice"));
    expect(view.getByText("child")).toBeInTheDocument();
    expect(useAppStore.getState().syncStatus).toBe("online");
  });
  it("reconciles deletions on foreground resume", async () => {
    fetchMock.mockResolvedValueOnce(json({ ...empty, pantry_items: [rice] }));
    render(<DataSync><div>child</div></DataSync>);
    await waitFor(() => expect(useAppStore.getState().pantry).toHaveLength(1));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(useAppStore.getState().pantry).toHaveLength(0));
  });
  it("keeps last successful data and shows a read error", async () => {
    fetchMock.mockResolvedValueOnce(json({ ...empty, pantry_items: [rice] }));
    const view = render(<DataSync><div>child</div></DataSync>);
    await waitFor(() => expect(useAppStore.getState().pantry).toHaveLength(1));
    fetchMock.mockResolvedValueOnce(json({ error: { message: "Temporarily unavailable" } }, 503));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(view.getByRole("status")).toHaveTextContent("Temporarily unavailable"));
    expect(useAppStore.getState().pantry).toHaveLength(1);
  });
  it("clears household data on membership loss", async () => {
    fetchMock.mockResolvedValueOnce(json({ ...empty, pantry_items: [rice] }));
    render(<DataSync><div>child</div></DataSync>);
    await waitFor(() => expect(useAppStore.getState().pantry).toHaveLength(1));
    fetchMock.mockResolvedValueOnce(json({ error: { message: "Forbidden" } }, 403));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(useAppStore.getState().pantry).toHaveLength(0));
    expect(h.refresh).toHaveBeenCalled();
  });
  it("ignores an old household response after switching identity", async () => {
    let finish!: (value: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const view = render(<DataSync><div>child</div></DataSync>);
    h.user = { id: "u2" }; h.household = { id: "h2", name: "Other" };
    view.rerender(<DataSync><div>child</div></DataSync>);
    await act(async () => { finish(json({ ...empty, pantry_items: [rice] })); });
    await waitFor(() => expect(useAppStore.getState()._identity).toBe("u2:h2"));
    expect(useAppStore.getState().pantry).toEqual([]);
  });
  it("does not let a stale offline identity check clear a new household's saved list", async () => {
    let finish!: (value: unknown) => void;
    offline.read.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const view = render(<DataSync><div>child</div></DataSync>);
    h.user = { id: "u2" }; h.household = { id: "h2", name: "Other" };
    view.rerender(<DataSync><div>child</div></DataSync>);
    await act(async () => { finish({ userId: "u2", householdId: "h2" }); });
    expect(offline.clear).not.toHaveBeenCalled();
  });
});
