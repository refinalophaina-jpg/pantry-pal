"use client";

import { useMemo, useState } from "react";
import {
  CalendarRange,
  ExternalLink,
  PackageCheck,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { startOfWeek, addDays, format } from "date-fns";
import { useAppStore } from "@/lib/store";
import { useSyncedActions } from "@/lib/data-sync";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
} from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/toast";
import { dealSearchUrl, fmtDate } from "@/lib/utils";
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

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<UnitType>("pcs");

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

  const grouped = useMemo(() => {
    const g: Record<string, typeof enriched> = {};
    enriched.forEach((it) => {
      g[it.category] = g[it.category] ?? [];
      g[it.category].push(it);
    });
    return g;
  }, [enriched]);

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

          {enriched.length === 0 ? (
            <EmptyState
              illustration="/illustrations/empty-shopping.svg"
              title="Nothing on the list yet"
              description="Hit “Build week's list” to pull everything this week's meal plan needs that you don't already have — or add items by hand."
            />
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <Card key={cat}>
                <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">
                  {cat}
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
                      {it.deal && (
                        <Badge tone="fresh">
                          {it.deal.store} ${it.deal.price.toFixed(2)}
                        </Badge>
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
            ))
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
    </div>
  );
}
