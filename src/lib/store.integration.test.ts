import { describe, it, expect, vi, beforeEach } from "vitest";

// A chainable Supabase mock. Results are keyed by table so multi-table actions
// (e.g. consumeItem updates pantry_items then inserts usage_events) resolve
// correctly. `then` makes the builder awaitable for delete chains.
const h = vi.hoisted(() => {
  const state: {
    resultsByTable: Record<string, { data: unknown; error: unknown }>;
    calls: unknown[][];
    table: string | null;
  } = { resultsByTable: {}, calls: [], table: null };
  const res = () =>
    state.resultsByTable[state.table ?? ""] ?? { data: null, error: null };
  const builder: Record<string, unknown> = {
    from(t: string) {
      state.table = t;
      state.calls.push(["from", t]);
      return builder;
    },
    insert(v: unknown) {
      state.calls.push(["insert", v]);
      return builder;
    },
    update(v: unknown) {
      state.calls.push(["update", v]);
      return builder;
    },
    delete() {
      state.calls.push(["delete"]);
      return builder;
    },
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    order() {
      return builder;
    },
    single() {
      return Promise.resolve(res());
    },
    maybeSingle() {
      return Promise.resolve(res());
    },
    then(r: (v: unknown) => unknown, j?: (e: unknown) => unknown) {
      return Promise.resolve(res()).then(r, j);
    },
  };
  return { state, builder };
});

vi.mock("./supabase", () => ({ getSupabase: () => h.builder }));

import { useAppStore } from "./store";
import type { PantryItem } from "./types";

const ctx = { householdId: "h1", userId: "u1" };

function pantryRow(over: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    household_id: "h1",
    name: "Rice",
    category: "Grains",
    quantity: 3,
    unit: "cup",
    zone: "pantry",
    expires_on: null,
    added_on: "2026-06-01",
    notes: null,
    ...over,
  };
}

function localPantryItem(over: Partial<PantryItem> = {}): PantryItem {
  return {
    id: "p1",
    name: "Rice",
    category: "Grains",
    quantity: 3,
    unit: "cup",
    zone: "pantry",
    addedOn: "2026-06-01",
    ...over,
  };
}

beforeEach(() => {
  h.state.calls = [];
  h.state.resultsByTable = {};
  h.state.table = null;
  useAppStore.setState({
    pantry: [],
    shopping: [],
    mealPlan: [],
    usage: [],
    savedRecipes: [],
    equipment: [],
  });
});

describe("store local actions", () => {
  it("toggleEquipment adds then removes by name", () => {
    const { toggleEquipment } = useAppStore.getState();
    toggleEquipment("wok");
    expect(useAppStore.getState().equipment.map((e) => e.name)).toContain("wok");
    toggleEquipment("wok");
    expect(useAppStore.getState().equipment.map((e) => e.name)).not.toContain(
      "wok",
    );
  });

  it("_upsertPantry inserts, then updates in place", () => {
    const s = useAppStore.getState();
    s._upsertPantry(localPantryItem({ id: "p1", quantity: 1 }));
    expect(useAppStore.getState().pantry).toHaveLength(1);
    s._upsertPantry(localPantryItem({ id: "p1", quantity: 9 }));
    const pantry = useAppStore.getState().pantry;
    expect(pantry).toHaveLength(1);
    expect(pantry[0].quantity).toBe(9);
  });
});

describe("store Supabase-backed actions", () => {
  it("addPantryItem inserts and upserts the mapped row", async () => {
    h.state.resultsByTable.pantry_items = {
      data: pantryRow({ id: "row-1", quantity: 3 }),
      error: null,
    };
    await useAppStore
      .getState()
      .addPantryItem(localPantryItem({ name: "Rice" }), ctx);

    const pantry = useAppStore.getState().pantry;
    expect(pantry).toHaveLength(1);
    expect(pantry[0].id).toBe("row-1");
    expect(pantry[0].quantity).toBe(3);
    expect(h.state.calls).toContainEqual(["from", "pantry_items"]);
    expect(h.state.calls.some((c) => c[0] === "insert")).toBe(true);
  });

  it("addPantryItem throws and leaves state untouched on error", async () => {
    h.state.resultsByTable.pantry_items = {
      data: null,
      error: { message: "denied" },
    };
    await expect(
      useAppStore.getState().addPantryItem(localPantryItem(), ctx),
    ).rejects.toBeTruthy();
    expect(useAppStore.getState().pantry).toHaveLength(0);
  });

  it("removePantryItem deletes and drops it from state", async () => {
    useAppStore.setState({ pantry: [localPantryItem({ id: "p1" })] });
    h.state.resultsByTable.pantry_items = { data: null, error: null };
    await useAppStore.getState().removePantryItem("p1", ctx);
    expect(useAppStore.getState().pantry).toHaveLength(0);
    expect(h.state.calls).toContainEqual(["delete"]);
  });

  it("consumeItem (partial) updates quantity and logs usage", async () => {
    useAppStore.setState({ pantry: [localPantryItem({ id: "p1", quantity: 5 })] });
    h.state.resultsByTable.pantry_items = {
      data: pantryRow({ id: "p1", quantity: 4 }),
      error: null,
    };
    h.state.resultsByTable.usage_events = {
      data: {
        id: "u1",
        household_id: "h1",
        item_id: "p1",
        item_name: "Rice",
        quantity: 1,
        unit: "cup",
        reason: "used",
        at: "2026-06-01T00:00:00Z",
      },
      error: null,
    };
    await useAppStore.getState().consumeItem("p1", 1, "used", ctx);

    expect(useAppStore.getState().pantry[0].quantity).toBe(4);
    expect(useAppStore.getState().usage).toHaveLength(1);
    expect(useAppStore.getState().usage[0].reason).toBe("used");
  });

  it("consumeItem (full) removes the item and logs usage", async () => {
    useAppStore.setState({ pantry: [localPantryItem({ id: "p1", quantity: 1 })] });
    h.state.resultsByTable.pantry_items = { data: null, error: null };
    h.state.resultsByTable.usage_events = {
      data: {
        id: "u2",
        household_id: "h1",
        item_id: "p1",
        item_name: "Rice",
        quantity: 1,
        unit: "cup",
        reason: "wasted",
        at: "2026-06-01T00:00:00Z",
      },
      error: null,
    };
    await useAppStore.getState().consumeItem("p1", 1, "wasted", ctx);

    expect(useAppStore.getState().pantry).toHaveLength(0);
    expect(useAppStore.getState().usage).toHaveLength(1);
    expect(useAppStore.getState().usage[0].reason).toBe("wasted");
  });
});
