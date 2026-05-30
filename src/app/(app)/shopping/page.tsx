"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  ExternalLink,
  MapPin,
  PackageCheck,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { startOfWeek, addDays, format } from "date-fns";
import { useAppStore } from "@/lib/store";
import { useSyncedActions } from "@/lib/data-sync";
import { useAuth } from "@/lib/auth-context";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
} from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/toast";
import { dealSearchUrl, fmtDate } from "@/lib/utils";
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

export default function ShoppingPage() {
  const shopping = useAppStore((s) => s.shopping);
  const deals = useAppStore((s) => s.deals);
  const recipes = useAppStore((s) => s.recipes);
  const pantry = useAppStore((s) => s.pantry);
  const {
    addShoppingItem,
    toggleShoppingItem,
    removeShoppingItem,
    clearCompleted,
    generateFromRecipe,
    buildWeekList,
    addPantryItem,
  } = useSyncedActions();
  const run = useAction();
  const { toast } = useToast();

  async function buildWeek() {
    try {
      const n = await buildWeekList(currentWeekDates());
      toast(
        n > 0
          ? `Added ${n} item${n === 1 ? "" : "s"} you still need this week.`
          : "You're already stocked for this week's plan 🎉",
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
      async () => {
        await addPantryItem({
          name: it.name,
          category: it.category === "This week" ? "Other" : it.category,
          quantity: it.quantity,
          unit: it.unit,
          zone: "pantry",
        });
        await removeShoppingItem(it.id);
      },
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

  useEffect(() => {
    if (!household) return;
    listStores(household.id).then(setStores).catch(() => {});
  }, [household]);

  useEffect(() => {
    if (!household || !activeStoreId) {
      setLocations([]);
      return;
    }
    listItemLocations(household.id, activeStoreId)
      .then(setLocations)
      .catch(() => {});
  }, [household, activeStoreId]);

  const activeStore = stores.find((s) => s.id === activeStoreId);

  function quickAddStore(storeName: string) {
    if (!household || !user) return;
    run(
      async () => {
        const s = await addStore(household.id, user.id, storeName, "77056");
        setStores((arr) =>
          [...arr, s].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setActiveStoreId(s.id);
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

  function smartFillFromExpiring() {
    const candidates = pantry
      .filter((p) => p.quantity <= 2 || (p.quantity <= 200 && p.unit === "g"))
      .slice(0, 6);
    if (candidates.length === 0) return;
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

  const enriched = useMemo(
    () =>
      shopping.map((s) => {
        const deal = deals.find(
          (d) => d.item.toLowerCase() === s.name.toLowerCase(),
        );
        return { ...s, deal };
      }),
    [shopping, deals],
  );

  const locByName = useMemo(() => {
    const m = new Map<string, ItemLocation>();
    locations.forEach((l) => m.set(l.item_name.toLowerCase(), l));
    return m;
  }, [locations]);

  // Group by store aisle when a store is selected, else by category.
  const grouped = useMemo(() => {
    const g: Record<string, typeof enriched> = {};
    enriched.forEach((it) => {
      const key = activeStoreId
        ? locByName.get(it.name.toLowerCase())?.aisle?.trim() || "Unsorted"
        : it.category;
      g[key] = g[key] ?? [];
      g[key].push(it);
    });
    return g;
  }, [enriched, activeStoreId, locByName]);

  const groupOrder = useMemo(() => {
    const keys = Object.keys(grouped);
    if (!activeStoreId) return keys;
    return keys.sort((a, b) => {
      if (a === "Unsorted") return 1;
      if (b === "Unsorted") return -1;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [grouped, activeStoreId]);

  const estimatedTotal = enriched.reduce(
    (sum, it) => sum + (it.deal?.price ?? 3.5) * it.quantity,
    0,
  );
  const dealSavings = enriched.reduce(
    (sum, it) => sum + (it.deal ? (3.5 - it.deal.price) * it.quantity : 0),
    0,
  );

  return (
    <div>
      <PageHeader
        title="Shopping list"
        subtitle="What you still need — built from this week's meal plan and your pantry."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={buildWeek}>
              <CalendarRange className="size-4" /> Build week&apos;s list
            </Button>
            <Button variant="secondary" size="sm" onClick={smartFillFromExpiring}>
              <Sparkles className="size-4" /> Smart fill
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                run(() => clearCompleted(), {
                  error: "Couldn't clear items — try again.",
                })
              }
              disabled={!enriched.some((e) => e.done)}
            >
              Clear done
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Add an item…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addQuick()}
                className="flex-1"
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  className="w-20"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
                <Select
                  className="w-20"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as UnitType)}
                >
                  {UNITS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </Select>
                <Button onClick={addQuick}>
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">
                Shopping at
              </span>
              <Select
                className="w-44"
                value={activeStoreId}
                onChange={(e) => setActiveStoreId(e.target.value)}
              >
                <option value="">By category</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              {activeStore && (
                <a
                  href={storeFinderUrl(
                    activeStore.name,
                    activeStore.zip || "77056",
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--accent-hover)] hover:underline"
                >
                  <MapPin className="size-3.5" /> Find near{" "}
                  {activeStore.zip || "me"}
                </a>
              )}
            </div>
            {SUGGESTED_STORES.filter(
              (s) =>
                !stores.some(
                  (st) => st.name.toLowerCase() === s.toLowerCase(),
                ),
            ).length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">
                  Add a store:
                </span>
                {SUGGESTED_STORES.filter(
                  (s) =>
                    !stores.some(
                      (st) => st.name.toLowerCase() === s.toLowerCase(),
                    ),
                ).map((s) => (
                  <button
                    key={s}
                    onClick={() => quickAddStore(s)}
                    className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs hover:border-[var(--accent)] transition-colors"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
            {activeStoreId && (
              <p className="text-[11px] text-[var(--text-muted)] mt-2">
                Grouped by aisle. Tap the pin on an item to record its aisle,
                shelf and price here — remembered for next time.
              </p>
            )}
          </Card>

          {enriched.length === 0 ? (
            <EmptyState
              illustration="/illustrations/empty-shopping.svg"
              title="Nothing on the list yet"
              description="Hit “Build week's list” to pull everything this week's meal plan needs that you don't already have — or add items by hand."
            />
          ) : (
            groupOrder.map((cat) => {
              const items = grouped[cat];
              return (
              <Card key={cat}>
                <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">
                  {activeStoreId
                    ? cat === "Unsorted"
                      ? "Unsorted — set aisles"
                      : `Aisle ${cat}`
                    : cat}
                </div>
                <ul className="space-y-2">
                  {items.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-center gap-3 group"
                    >
                      <input
                        type="checkbox"
                        checked={it.done}
                        onChange={() =>
                          run(() => toggleShoppingItem(it.id), {
                            error: "Couldn't update the item — try again.",
                          })
                        }
                        className="size-4 accent-[var(--accent)]"
                      />
                      <div className="flex-1">
                        <div
                          className={`text-sm ${
                            it.done
                              ? "line-through text-[var(--text-muted)]"
                              : ""
                          }`}
                        >
                          {it.name}{" "}
                          <span className="text-[var(--text-muted)]">
                            · {it.quantity}
                            {it.unit}
                          </span>
                          {it.fromRecipe && (
                            <span className="text-xs text-[var(--text-muted)] ml-2">
                              from {it.fromRecipe}
                            </span>
                          )}
                        </div>
                      </div>
                      {activeStoreId &&
                        locByName.get(it.name.toLowerCase())?.price != null && (
                          <Badge tone="fresh">
                            $
                            {locByName
                              .get(it.name.toLowerCase())!
                              .price!.toFixed(2)}
                          </Badge>
                        )}
                      {it.deal && (
                        <Badge tone="fresh">
                          {it.deal.store} ${it.deal.price.toFixed(2)}
                        </Badge>
                      )}
                      {activeStoreId && (
                        <button
                          onClick={() => setEditItem(it.name)}
                          className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent-hover)]"
                          aria-label="Set aisle / shelf / price"
                          title="Set aisle / shelf / price"
                        >
                          <MapPin className="size-4" />
                        </button>
                      )}
                      <button
                        onClick={() => moveToPantry(it)}
                        className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--accent-hover)]"
                        aria-label="Got it — move to pantry"
                        title="Got it — move to pantry"
                      >
                        <PackageCheck className="size-4" />
                      </button>
                      <button
                        onClick={() =>
                          run(() => removeShoppingItem(it.id), {
                            error: "Couldn't remove the item — try again.",
                          })
                        }
                        className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--danger)]"
                        aria-label="Remove"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">
              Estimated cost
            </div>
            <div className="text-3xl font-semibold">
              ${estimatedTotal.toFixed(2)}
            </div>
            {dealSavings > 0 && (
              <div className="text-xs text-[var(--accent-hover)] mt-1">
                ↓ ${dealSavings.toFixed(2)} saved via deals
              </div>
            )}
          </Card>

          <Card>
            <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">
              Generate from recipe
            </div>
            <div className="space-y-2">
              {recipes.slice(0, 4).map((r) => (
                <Button
                  key={r.id}
                  variant="secondary"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() =>
                    run(() => generateFromRecipe(r.id), {
                      success: `Missing ingredients for ${r.name} added.`,
                      error: "Couldn't build the list — try again.",
                    })
                  }
                >
                  {r.name}
                </Button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">
              Local deals
            </div>
            <ul className="space-y-1">
              {deals.map((d) => (
                <li key={d.id}>
                  <a
                    href={dealSearchUrl(d.item, d.store)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex justify-between gap-2 rounded-lg -mx-2 px-2 py-1.5 text-sm hover:bg-[var(--bg)] transition-colors"
                    title={`Compare prices for ${d.item}`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-1">
                        {d.item}
                        <ExternalLink className="size-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {d.store} · until {fmtDate(d.validUntil)}
                      </div>
                    </div>
                    <span className="font-semibold whitespace-nowrap">
                      ${d.price.toFixed(2)}
                      <span className="text-xs font-normal text-[var(--text-muted)]">
                        /{d.unit}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </div>
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
    <Modal open onClose={onClose} title={`Where is "${itemName}"?`}>
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-[var(--text-muted)] block mb-1">
              Aisle
            </label>
            <Input
              value={aisle}
              onChange={(e) => setAisle(e.target.value)}
              placeholder="e.g. 7"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-[var(--text-muted)] block mb-1">
              Shelf / section
            </label>
            <Input
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g. top shelf, end cap"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-[var(--text-muted)] block mb-1">
            Price ($)
          </label>
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 3.49"
            className="w-32"
          />
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
