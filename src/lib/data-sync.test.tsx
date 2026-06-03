import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { DataSync } from "./data-sync";
import { useAppStore } from "./store";

const h = vi.hoisted(() => {
  const state = {
    byTable: {} as Record<string, unknown[]>,
    removeChannel: vi.fn(),
    subscribe: vi.fn(),
  };
  return { state };
});

vi.mock("./auth-context", () => ({
  useAuth: () => ({
    household: { id: "h1", name: "Home", role: "owner" },
    user: { id: "u1" },
  }),
}));

vi.mock("./supabase", () => ({
  getSupabase: () => ({
    from: (table: string) => {
      const result = { data: h.state.byTable[table] ?? [], error: null };
      const b: Record<string, unknown> = {
        select: () => b,
        eq: () => b,
        order: () => b,
        limit: () => b,
        then: (r: (v: unknown) => unknown) => Promise.resolve(result).then(r),
      };
      return b;
    },
    channel: () => {
      const ch: Record<string, unknown> = {
        on: () => ch,
        subscribe: () => {
          h.state.subscribe();
          return ch;
        },
      };
      return ch;
    },
    removeChannel: h.state.removeChannel,
  }),
}));

beforeEach(() => {
  h.state.byTable = {};
  h.state.removeChannel.mockReset();
  h.state.subscribe.mockReset();
  useAppStore.setState({
    pantry: [],
    shopping: [],
    mealPlan: [],
    usage: [],
    savedRecipes: [],
  });
});

describe("DataSync", () => {
  it("loads household data into the store and subscribes to realtime", async () => {
    h.state.byTable = {
      pantry_items: [
        {
          id: "p1",
          household_id: "h1",
          name: "Rice",
          category: "Grains",
          quantity: 2,
          unit: "cup",
          zone: "pantry",
          expires_on: null,
          added_on: "2026-06-01",
          notes: null,
        },
      ],
      shopping_items: [
        {
          id: "s1",
          household_id: "h1",
          name: "Milk",
          quantity: 1,
          unit: "l",
          category: "Dairy",
          done: false,
          from_recipe: null,
          deal_price: null,
          deal_store: null,
        },
      ],
    };

    render(
      <DataSync>
        <div>child</div>
      </DataSync>,
    );

    await waitFor(() =>
      expect(useAppStore.getState().pantry).toHaveLength(1),
    );
    expect(useAppStore.getState().pantry[0].name).toBe("Rice");
    expect(useAppStore.getState().shopping[0].name).toBe("Milk");
    expect(h.state.subscribe).toHaveBeenCalled();
  });

  it("renders its children", () => {
    const { getByText } = render(
      <DataSync>
        <div>hello child</div>
      </DataSync>,
    );
    expect(getByText("hello child")).toBeInTheDocument();
  });
});
