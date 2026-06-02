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
    in() {
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

describe("moveMealPlan", () => {
  const entry = {
    id: "m1",
    date: "2026-06-01",
    meal: "dinner" as const,
    recipeId: "r1",
  };

  it("moves an entry to a new slot and reconciles from the DB row", async () => {
    useAppStore.setState({ mealPlan: [entry] });
    h.state.resultsByTable.meal_plan = {
      data: {
        id: "m1",
        household_id: "h1",
        date: "2026-06-02",
        meal: "lunch",
        recipe_id: "r1",
      },
      error: null,
    };
    await useAppStore
      .getState()
      .moveMealPlan("m1", { date: "2026-06-02", meal: "lunch" }, ctx);
    const m = useAppStore.getState().mealPlan;
    expect(m).toHaveLength(1);
    expect(m[0].date).toBe("2026-06-02");
    expect(m[0].meal).toBe("lunch");
    expect(h.state.calls.some((c) => c[0] === "update")).toBe(true);
  });

  it("is a no-op when dropped on its own slot (no DB call)", async () => {
    useAppStore.setState({ mealPlan: [entry] });
    await useAppStore
      .getState()
      .moveMealPlan("m1", { date: "2026-06-01", meal: "dinner" }, ctx);
    expect(h.state.calls.some((c) => c[0] === "update")).toBe(false);
    expect(useAppStore.getState().mealPlan[0].date).toBe("2026-06-01");
  });

  it("reverts the optimistic move on error", async () => {
    useAppStore.setState({ mealPlan: [entry] });
    h.state.resultsByTable.meal_plan = {
      data: null,
      error: { message: "denied" },
    };
    await expect(
      useAppStore
        .getState()
        .moveMealPlan("m1", { date: "2026-06-03", meal: "breakfast" }, ctx),
    ).rejects.toBeTruthy();
    // reverted to the original slot
    const m = useAppStore.getState().mealPlan;
    expect(m[0].date).toBe("2026-06-01");
    expect(m[0].meal).toBe("dinner");
  });
});

function shoppingRow(over: Record<string, unknown> = {}) {
  return {
    id: "s-row",
    household_id: "h1",
    name: "Milk",
    quantity: 1,
    unit: "l",
    category: "Dairy",
    done: false,
    from_recipe: null,
    deal_price: null,
    deal_store: null,
    ...over,
  };
}

describe("store shopping actions", () => {
  it("addShoppingItem inserts and upserts the mapped row", async () => {
    h.state.resultsByTable.shopping_items = {
      data: shoppingRow({ id: "s1", name: "Milk" }),
      error: null,
    };
    await useAppStore.getState().addShoppingItem(
      { name: "Milk", quantity: 1, unit: "l", category: "Dairy" },
      ctx,
    );
    expect(useAppStore.getState().shopping).toHaveLength(1);
    expect(useAppStore.getState().shopping[0].name).toBe("Milk");
  });

  it("toggleShoppingItem flips done from the returned row", async () => {
    useAppStore.setState({
      shopping: [
        {
          id: "s1",
          name: "Milk",
          quantity: 1,
          unit: "l",
          category: "Dairy",
          done: false,
        },
      ],
    });
    h.state.resultsByTable.shopping_items = {
      data: shoppingRow({ id: "s1", done: true }),
      error: null,
    };
    await useAppStore.getState().toggleShoppingItem("s1", ctx);
    expect(useAppStore.getState().shopping[0].done).toBe(true);
  });

  it("removeShoppingItem deletes from state", async () => {
    useAppStore.setState({
      shopping: [
        {
          id: "s1",
          name: "Milk",
          quantity: 1,
          unit: "l",
          category: "Dairy",
          done: false,
        },
      ],
    });
    h.state.resultsByTable.shopping_items = { data: null, error: null };
    await useAppStore.getState().removeShoppingItem("s1", ctx);
    expect(useAppStore.getState().shopping).toHaveLength(0);
  });

  it("clearCompleted removes only done items", async () => {
    useAppStore.setState({
      shopping: [
        { id: "a", name: "A", quantity: 1, unit: "pcs", category: "x", done: true },
        { id: "b", name: "B", quantity: 1, unit: "pcs", category: "x", done: false },
      ],
    });
    h.state.resultsByTable.shopping_items = { data: null, error: null };
    await useAppStore.getState().clearCompleted(ctx);
    const left = useAppStore.getState().shopping;
    expect(left).toHaveLength(1);
    expect(left[0].id).toBe("b");
  });
});

describe("store saved-recipe + meal-plan actions", () => {
  it("saveRecipe inserts and returns the saved id", async () => {
    h.state.resultsByTable.saved_recipes = {
      data: { id: "abc", household_id: "h1", name: "Stew" },
      error: null,
    };
    const id = await useAppStore.getState().saveRecipe(
      {
        id: "r1",
        name: "Stew",
        description: "",
        cuisine: "Custom",
        minutes: 30,
        difficulty: "easy",
        servings: 2,
        equipment: [],
        ingredients: [],
        steps: [],
        tags: [],
      },
      ctx,
    );
    expect(id).toBe("saved-abc");
    expect(useAppStore.getState().savedRecipes).toHaveLength(1);
  });

  it("unsaveRecipe removes it from state", async () => {
    useAppStore.setState({
      savedRecipes: [
        {
          id: "saved-abc",
          savedId: "abc",
          name: "Stew",
          description: "",
          cuisine: "Custom",
          minutes: 30,
          difficulty: "easy",
          servings: 2,
          equipment: [],
          ingredients: [],
          steps: [],
          tags: [],
        },
      ],
    });
    h.state.resultsByTable.saved_recipes = { data: null, error: null };
    await useAppStore.getState().unsaveRecipe("abc", ctx);
    expect(useAppStore.getState().savedRecipes).toHaveLength(0);
  });

  it("addMealPlan inserts and upserts", async () => {
    h.state.resultsByTable.meal_plan = {
      data: {
        id: "m1",
        household_id: "h1",
        date: "2026-06-02",
        meal: "dinner",
        recipe_id: "r1",
      },
      error: null,
    };
    await useAppStore
      .getState()
      .addMealPlan({ date: "2026-06-02", meal: "dinner", recipeId: "r1" }, ctx);
    expect(useAppStore.getState().mealPlan).toHaveLength(1);
    expect(useAppStore.getState().mealPlan[0].meal).toBe("dinner");
  });

  it("removeMealPlan deletes from state", async () => {
    useAppStore.setState({
      mealPlan: [{ id: "m1", date: "2026-06-02", meal: "dinner", recipeId: "r1" }],
    });
    h.state.resultsByTable.meal_plan = { data: null, error: null };
    await useAppStore.getState().removeMealPlan("m1", ctx);
    expect(useAppStore.getState().mealPlan).toHaveLength(0);
  });
});

describe("cookRecipe", () => {
  const recipe = {
    id: "rc1",
    name: "Two-Ingredient",
    description: "",
    cuisine: "Test",
    minutes: 10,
    difficulty: "easy" as const,
    servings: 1,
    equipment: [],
    ingredients: [
      { name: "rice", quantity: 1, unit: "cup" as const },
      { name: "egg", quantity: 2, unit: "pcs" as const },
    ],
    steps: [],
    tags: [],
  };

  it("returns missing ingredients without consuming when short", async () => {
    useAppStore.setState({
      recipes: [recipe],
      pantry: [localPantryItem({ id: "p1", name: "rice", quantity: 1, unit: "cup" })],
    });
    const result = await useAppStore.getState().cookRecipe("rc1", ctx);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("egg");
    // nothing was consumed
    expect(h.state.calls.some((c) => c[0] === "update")).toBe(false);
  });
});

describe("buildWeekList + generateFromRecipe", () => {
  const recipe = {
    id: "r1",
    name: "Egg Fried Rice",
    description: "",
    cuisine: "Chinese",
    minutes: 20,
    difficulty: "easy" as const,
    servings: 2,
    equipment: [],
    ingredients: [
      { name: "rice", quantity: 2, unit: "cup" as const },
      { name: "egg", quantity: 3, unit: "pcs" as const },
    ],
    steps: [],
    tags: [],
  };

  it("buildWeekList adds only the deficit, skipping owned + listed items", async () => {
    useAppStore.setState({
      recipes: [recipe],
      mealPlan: [
        { id: "m1", date: "2026-06-01", meal: "dinner", recipeId: "r1" },
      ],
      pantry: [localPantryItem({ id: "p1", name: "rice", quantity: 5, unit: "cup" })],
      shopping: [],
    });
    h.state.resultsByTable.shopping_items = {
      data: shoppingRow({ id: "sx", name: "egg" }),
      error: null,
    };
    // rice is covered (have 5 >= 2); only egg is short -> 1 item added.
    const added = await useAppStore
      .getState()
      .buildWeekList(["2026-06-01"], ctx);
    expect(added).toBe(1);
  });

  it("buildWeekList skips an ingredient already on the list", async () => {
    useAppStore.setState({
      recipes: [recipe],
      mealPlan: [
        { id: "m1", date: "2026-06-01", meal: "dinner", recipeId: "r1" },
      ],
      pantry: [localPantryItem({ id: "p1", name: "rice", quantity: 5, unit: "cup" })],
      shopping: [
        { id: "s1", name: "egg", quantity: 1, unit: "pcs", category: "x", done: false },
      ],
    });
    const added = await useAppStore
      .getState()
      .buildWeekList(["2026-06-01"], ctx);
    expect(added).toBe(0);
  });

  it("generateFromRecipe adds the missing ingredients to the list", async () => {
    useAppStore.setState({
      recipes: [recipe],
      pantry: [localPantryItem({ id: "p1", name: "rice", quantity: 5, unit: "cup" })],
      shopping: [],
    });
    h.state.resultsByTable.shopping_items = {
      data: shoppingRow({ id: "sx", name: "egg", category: "From recipe" }),
      error: null,
    };
    await useAppStore.getState().generateFromRecipe("r1", ctx);
    expect(useAppStore.getState().shopping.some((s) => s.name === "egg")).toBe(
      true,
    );
  });
});
