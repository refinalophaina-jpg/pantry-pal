"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, PackageCheck, Plus, Trash2 } from "lucide-react";
import { startOfWeek, addDays, format } from "date-fns";
import { useAppStore } from "@/lib/store";
import { useSyncedActions } from "@/lib/data-sync";
import { useAuth } from "@/lib/auth-context";
import {
  Button,
  EmptyState,
  Input,
  Label,
  Modal,
  SectionTitle,
  Select,
} from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";
import {
  listStores,
  addStore,
  listItemLocations,
  upsertItemLocation,
  storeFinderUrl,
  SUGGESTED_STORES,
  type Store,
  type ItemLocation,
} from "@/lib/stores";
import type { UnitType } from "@/lib/types";

const UNITS: UnitType[] = ["pcs", "g", "kg", "ml", "l", "tbsp", "tsp", "cup"];

// Mon–Sun of the current week, as yyyy-MM-dd. Computed on demand (in a click
// handler, never during render) so it stays hydration-safe.
function currentWeekDates(): string[] {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(start, i), "yyyy-MM-dd"),
  );
}

// A request cancelled by navigation or an identity change is not an error
// the person needs to hear about.
function isAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export default function ShoppingPage() {
  const shopping = useAppStore((s) => s.shopping);
  const recipes = useAppStore((s) => s.recipes);
  const pantry = useAppStore((s) => s.pantry);
  const {
    addShoppingItem,
    toggleShoppingItem,
    removeShoppingItem,
    clearCompleted,
    generateFromRecipe,
    buildWeekList,
    moveShoppingToPantry,
  } = useSyncedActions();
  const run = useAction();
  const { toast } = useToast();

  async function buildWeek() {
    try {
      const n = await buildWeekList(currentWeekDates());
      toast(
        n > 0
          ? `Added ${n} item${n === 1 ? "" : "s"} you still need this week.`
          : "You already have everything this week's plan needs.",
        n > 0 ? "success" : "info",
      );
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Couldn't build the list.",
        "warn",
      );
    }
  }

  // "Got it" — move a purchased item into the pantry and off the list.
  function moveToPantry(it: (typeof shopping)[number]) {
    run(
      () => moveShoppingToPantry(it.id),
      {
        success: `${it.name} moved to your pantry.`,
        error: "Couldn't move the item — try again.",
      },
    );
  }

  const { household, user } = useAuth();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<UnitType>("pcs");

  // Stores + per-store item layout (self-contained from the global store).
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string>("");
  const [locations, setLocations] = useState<ItemLocation[]>([]);
  const [editItem, setEditItem] = useState<string | null>(null);
  const [addingStore, setAddingStore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStores([]);
    setLocations([]);
    setActiveStoreId("");
    if (household) listStores(household.id).then((items) => { if (!cancelled) setStores(items); }).catch((error) => {
      if (!cancelled && !isAbort(error)) toast(error instanceof Error ? error.message : "Could not load your stores.", "warn");
    });
    return () => { cancelled = true; };
  }, [household?.id, user?.id, toast]);

  useEffect(() => {
    let cancelled = false;
    setLocations([]);
    if (household && activeStoreId) listItemLocations(household.id, activeStoreId)
      .then((items) => { if (!cancelled) setLocations(items); })
      .catch((error) => { if (!cancelled && !isAbort(error)) toast(error instanceof Error ? error.message : "Could not load this store's layout.", "warn"); });
    return () => { cancelled = true; };
  }, [household?.id, user?.id, activeStoreId, toast]);

  const activeStore = stores.find((s) => s.id === activeStoreId);
  const suggestedStores = SUGGESTED_STORES.filter(
    (s) => !stores.some((st) => st.name.toLowerCase() === s.toLowerCase()),
  );

  function quickAddStore(storeName: string) {
    if (!household || !user) return;
    run(
      async () => {
        const s = await addStore(household.id, user.id, storeName, "77056");
        setStores((arr) =>
          [...arr, s].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setActiveStoreId(s.id);
        setAddingStore(false);
      },
      { success: `${storeName} added.`, error: "Couldn't add the store." },
    );
  }

  function saveLocation(
    itemName: string,
    patch: { aisle?: string; section?: string; price?: number | null },
  ) {
    if (!household || !user || !activeStoreId) return;
    run(
      async () => {
        const loc = await upsertItemLocation({
          householdId: household.id,
          userId: user.id,
          storeId: activeStoreId,
          itemName,
          ...patch,
        });
        setLocations((arr) => [
          ...arr.filter(
            (l) => l.item_name.toLowerCase() !== itemName.toLowerCase(),
          ),
          loc,
        ]);
      },
      { success: "Saved.", error: "Couldn't save the location." },
    );
    setEditItem(null);
  }

  async function addQuick() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const ok = await run(
      () =>
        addShoppingItem({ name: trimmed, quantity, unit, category: "Manual" }),
      { error: "Couldn't add to the list — try again." },
    );
    if (ok) {
      setName("");
      setQuantity(1);
    }
  }

  function addLowStock() {
    const candidates = pantry
      .filter((p) => p.quantity <= 2 || (p.quantity <= 200 && p.unit === "g"))
      .slice(0, 6);
    if (candidates.length === 0) {
      toast("Nothing in the pantry is running low.", "info");
      return;
    }
    run(
      async () => {
        // sequential so concurrent inserts don't race
        for (const c of candidates) {
          await addShoppingItem({
            name: c.name,
            quantity: c.unit === "g" ? 500 : 2,
            unit: c.unit,
            category: "Low stock",
          });
        }
      },
      {
        success: `Added ${candidates.length} low-stock item${candidates.length === 1 ? "" : "s"}.`,
        error: "Couldn't fill the list — try again.",
      },
    );
  }

  const locByName = useMemo(() => {
    const m = new Map<string, ItemLocation>();
    locations.forEach((l) => m.set(l.item_name.toLowerCase(), l));
    return m;
  }, [locations]);

  // Group by store aisle when a store is selected, else by category.
  const grouped = useMemo(() => {
    const g: Record<string, typeof shopping> = {};
    shopping.forEach((it) => {
      const key = activeStoreId
        ? locByName.get(it.name.toLowerCase())?.aisle?.trim() || "Unsorted"
        : it.category;
      g[key] = g[key] ?? [];
      g[key].push(it);
    });
    return g;
  }, [shopping, activeStoreId, locByName]);

  const groupOrder = useMemo(() => {
    const keys = Object.keys(grouped);
    if (!activeStoreId) return keys;
    return keys.sort((a, b) => {
      if (a === "Unsorted") return 1;
      if (b === "Unsorted") return -1;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [grouped, activeStoreId]);

  const anyDone = shopping.some((e) => e.done);

  return (
    <div>
      <PageHeader
        title="Shopping list"
        subtitle="Built from this week's meal plan and what is already in your pantry."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={buildWeek}>
              Build week&apos;s list
            </Button>
            <Button variant="secondary" size="sm" onClick={addLowStock}>
              Add low stock
            </Button>
            {anyDone && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  run(() => clearCompleted(), {
                    error: "Couldn't clear items — try again.",
                  })
                }
              >
                Clear done
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
        <div className="space-y-6">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => { e.preventDefault(); void addQuick(); }}
          >
            <Input
              aria-label="Shopping item name"
              placeholder="Add an item…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Input
                aria-label="Shopping quantity"
                type="number"
                min={0}
                className="w-20"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
              <Select
                aria-label="Shopping unit"
                className="w-24"
                value={unit}
                onChange={(e) => setUnit(e.target.value as UnitType)}
              >
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </Select>
              <Button type="submit" aria-label="Add shopping item" className="px-3">
                <Plus className="size-4" />
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <label htmlFor="shopping-store" className="text-[var(--text-muted)]">Group by</label>
            <Select
              id="shopping-store"
              aria-label="Shopping store"
              className="w-44"
              value={activeStoreId}
              onChange={(e) => setActiveStoreId(e.target.value)}
            >
              <option value="">Category</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (aisle)
                </option>
              ))}
            </Select>
            {activeStore && (
              <a
                href={storeFinderUrl(activeStore.name, activeStore.zip || "77056")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
              >
                <MapPin className="size-3.5" aria-hidden="true" /> Find near {activeStore.zip || "me"}
              </a>
            )}
            {suggestedStores.length > 0 && (
              <button
                type="button"
                onClick={() => setAddingStore((v) => !v)}
                aria-expanded={addingStore}
                className="min-h-11 text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
              >
                {addingStore ? "Cancel" : "Add a store"}
              </button>
            )}
            {addingStore && (
              <div className="flex w-full flex-wrap gap-2">
                {suggestedStores.map((s) => (
                  <Button key={s} variant="secondary" size="sm" onClick={() => quickAddStore(s)}>
                    <Plus className="size-3.5" /> {s}
                  </Button>
                ))}
              </div>
            )}
          </div>
          {activeStoreId && (
            <p className="text-sm text-[var(--text-muted)]">
              Grouped by aisle. Use the pin on an item to record its aisle, shelf and price for next time.
            </p>
          )}

          {shopping.length === 0 ? (
            <EmptyState
              title="Nothing on the list"
              description="Build it from this week's meal plan, or add items above."
              action={<Button variant="secondary" onClick={buildWeek}>Build week&apos;s list</Button>}
            />
          ) : (
            <div className="space-y-6">
              {groupOrder.map((cat) => (
                <section key={cat} aria-label={cat}>
                  <h2 className="mb-1 text-sm font-medium text-[var(--text-muted)]">
                    {activeStoreId
                      ? cat === "Unsorted"
                        ? "No aisle yet"
                        : `Aisle ${cat}`
                      : cat}
                  </h2>
                  <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {grouped[cat].map((it) => {
                      const price = activeStoreId ? locByName.get(it.name.toLowerCase())?.price : null;
                      return (
                        <li key={it.id} className="flex items-center gap-1 py-0.5">
                          <label className="inline-flex size-11 shrink-0 items-center justify-center">
                            <input
                              type="checkbox"
                              aria-label={`Mark ${it.name} as purchased`}
                              checked={it.done}
                              onChange={() =>
                                run(() => toggleShoppingItem(it.id), {
                                  error: "Couldn't update the item — try again.",
                                })
                              }
                              className="size-4 accent-[var(--accent)]"
                            />
                          </label>
                          <div className={cn("min-w-0 flex-1 break-words text-sm", it.done && "text-[var(--text-muted)] line-through")}>
                            <span className="font-medium">{it.name}</span>
                            <span className="text-[var(--text-muted)]"> · {it.quantity} {it.unit}</span>
                            {it.fromRecipe && (
                              <span className="block text-xs text-[var(--text-muted)]">for {it.fromRecipe}</span>
                            )}
                          </div>
                          {price != null && (
                            <span className="shrink-0 text-sm tabular-nums text-[var(--text-muted)]">${price.toFixed(2)}</span>
                          )}
                          {activeStoreId && (
                            <button
                              type="button"
                              onClick={() => setEditItem(it.name)}
                              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--text-faint)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
                              aria-label="Set aisle / shelf / price"
                              title="Set aisle, shelf and price"
                            >
                              <MapPin className="size-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => moveToPantry(it)}
                            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--text-faint)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
                            aria-label="Got it — move to pantry"
                            title="Got it: move to pantry"
                          >
                            <PackageCheck className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              run(() => removeShoppingItem(it.id), {
                                error: "Couldn't remove the item — try again.",
                              })
                            }
                            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--text-faint)] hover:bg-[var(--bg)] hover:text-[var(--danger)]"
                            aria-label="Remove"
                            title="Remove from list"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <aside>
          <SectionTitle>From a recipe</SectionTitle>
          <p className="mb-2 text-sm text-[var(--text-muted)]">
            Adds the ingredients you don&apos;t have yet.
          </p>
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {recipes.slice(0, 5).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 py-2 text-left text-sm hover:text-[var(--accent-hover)]"
                  onClick={() =>
                    run(() => generateFromRecipe(r.id), {
                      success: `Missing ingredients for ${r.name} added.`,
                      error: "Couldn't build the list — try again.",
                    })
                  }
                >
                  <span className="min-w-0 truncate">{r.name}</span>
                  <Plus className="size-4 shrink-0 text-[var(--text-faint)]" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {editItem && (
        <LocationEditor
          itemName={editItem}
          current={locByName.get(editItem.toLowerCase()) ?? null}
          onClose={() => setEditItem(null)}
          onSave={(patch) => saveLocation(editItem, patch)}
        />
      )}
    </div>
  );
}

function LocationEditor({
  itemName,
  current,
  onClose,
  onSave,
}: {
  itemName: string;
  current: ItemLocation | null;
  onClose: () => void;
  onSave: (patch: {
    aisle?: string;
    section?: string;
    price?: number | null;
  }) => void;
}) {
  const [aisle, setAisle] = useState(current?.aisle ?? "");
  const [section, setSection] = useState(current?.section ?? "");
  const [price, setPrice] = useState(
    current?.price != null ? String(current.price) : "",
  );
  return (
    <Modal open onClose={onClose} title={`Where is ${itemName}?`}>
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="loc-aisle">Aisle</Label>
            <Input id="loc-aisle" value={aisle} onChange={(e) => setAisle(e.target.value)} placeholder="e.g. 7" />
          </div>
          <div className="flex-1">
            <Label htmlFor="loc-section">Shelf or section</Label>
            <Input id="loc-section" value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. top shelf" />
          </div>
        </div>
        <div>
          <Label htmlFor="loc-price">Price ($)</Label>
          <Input id="loc-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 3.49" className="w-32" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                aisle: aisle.trim() || undefined,
                section: section.trim() || undefined,
                price: price.trim() === "" ? null : Number(price),
              })
            }
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
