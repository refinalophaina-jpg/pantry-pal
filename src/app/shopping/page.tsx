"use client";

import { useMemo, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
} from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { fmtDate } from "@/lib/utils";
import type { UnitType } from "@/lib/types";

const UNITS: UnitType[] = ["pcs", "g", "kg", "ml", "l", "tbsp", "tsp", "cup"];

export default function ShoppingPage() {
  const shopping = useAppStore((s) => s.shopping);
  const deals = useAppStore((s) => s.deals);
  const recipes = useAppStore((s) => s.recipes);
  const pantry = useAppStore((s) => s.pantry);
  const addShoppingItem = useAppStore((s) => s.addShoppingItem);
  const toggleShoppingItem = useAppStore((s) => s.toggleShoppingItem);
  const removeShoppingItem = useAppStore((s) => s.removeShoppingItem);
  const clearCompleted = useAppStore((s) => s.clearCompleted);

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<UnitType>("pcs");

  function addQuick() {
    if (!name.trim()) return;
    addShoppingItem({
      name: name.trim(),
      quantity,
      unit,
      category: "Manual",
    });
    setName("");
    setQuantity(1);
  }

  function smartFillFromExpiring() {
    const candidates = pantry
      .filter((p) => p.quantity <= 2 || (p.quantity <= 200 && p.unit === "g"))
      .slice(0, 6);
    candidates.forEach((c) =>
      addShoppingItem({
        name: c.name,
        quantity: c.unit === "g" ? 500 : 2,
        unit: c.unit,
        category: "Low stock",
      }),
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
        subtitle="Auto-matched against local deals from nearby stores."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={smartFillFromExpiring}>
              <Sparkles className="size-4" /> Smart fill
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={clearCompleted}
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
              title="Nothing on the list yet"
              description="Add items above, or hit Smart fill to grab pantry low-stock items."
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
                        onChange={() => toggleShoppingItem(it.id)}
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
                        onClick={() => removeShoppingItem(it.id)}
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
                    useAppStore.getState().generateFromRecipe(r.id)
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
            <ul className="space-y-2">
              {deals.map((d) => (
                <li key={d.id} className="text-sm flex justify-between gap-2">
                  <div>
                    <div className="font-medium">{d.item}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {d.store} · until {fmtDate(d.validUntil)}
                    </div>
                  </div>
                  <span className="font-semibold whitespace-nowrap">
                    ${d.price.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
