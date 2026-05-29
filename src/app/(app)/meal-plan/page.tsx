"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useSyncedActions } from "@/lib/data-sync";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  Select,
} from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { useMounted } from "@/lib/use-mounted";
import { useAction } from "@/lib/use-action";
import { format, startOfWeek, addDays, parseISO } from "date-fns";

const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;

export default function MealPlanPage() {
  const recipes = useAppStore((s) => s.recipes);
  const mealPlan = useAppStore((s) => s.mealPlan);
  const { addMealPlan, removeMealPlan } = useSyncedActions();
  const run = useAction();

  const [weekOffset, setWeekOffset] = useState(0);
  const [addContext, setAddContext] = useState<
    null | { date: string; meal: (typeof MEALS)[number] }
  >(null);

  // The week grid is computed from the current date, which differs between the
  // static-export build and the client. Defer it to after mount so server HTML
  // and the first client render agree (empty grid), then render the real week.
  const mounted = useMounted();
  const todayStr = mounted ? format(new Date(), "yyyy-MM-dd") : null;

  const weekStart = useMemo(() => {
    if (!mounted) return null;
    return addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7);
  }, [mounted, weekOffset]);

  const days = useMemo(() => {
    if (!weekStart) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      return {
        date: format(d, "yyyy-MM-dd"),
        label: format(d, "EEE"),
        short: format(d, "d"),
      };
    });
  }, [weekStart]);

  return (
    <div>
      <PageHeader
        title="Meal plan"
        subtitle="Drag a recipe onto a slot — or use the menu picker."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWeekOffset((v) => v - 1)}
            >
              ← Prev week
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
            >
              This week
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWeekOffset((v) => v + 1)}
            >
              Next →
            </Button>
          </div>
        }
      />

      <Card className="overflow-x-auto p-0">
        {!mounted ? (
          <div className="min-w-[800px] p-3 space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="h-[72px] rounded-md bg-[var(--bg)] animate-pulse"
              />
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-[100px_repeat(7,minmax(140px,1fr))] min-w-[800px]">
          <div className="p-3 text-xs text-[var(--text-muted)] border-b border-[var(--border)]" />
          {days.map((d) => {
            const isToday = d.date === todayStr;
            return (
              <div
                key={d.date}
                className={`p-3 text-center border-b border-l border-[var(--border)] ${
                  isToday ? "bg-[var(--accent-soft)]" : ""
                }`}
              >
                <div className="text-xs text-[var(--text-muted)]">{d.label}</div>
                <div className="text-lg font-semibold">{d.short}</div>
              </div>
            );
          })}
          {MEALS.map((meal) => (
            <Row
              key={meal}
              meal={meal}
              days={days}
              mealPlan={mealPlan}
              onAdd={(date) => setAddContext({ date, meal })}
              onRemove={(id) =>
                run(() => removeMealPlan(id), {
                  error: "Couldn't remove the meal — try again.",
                })
              }
              recipes={recipes}
            />
          ))}
        </div>
        )}
      </Card>

      {mealPlan.length === 0 && (
        <div className="mt-4">
          <EmptyState
            illustration="/illustrations/empty-meal-plan.svg"
            title="No meals planned yet"
            description="Tap any slot to drop in a recipe."
          />
        </div>
      )}

      <Modal
        open={addContext !== null}
        onClose={() => setAddContext(null)}
        title={
          addContext
            ? `Add ${addContext.meal} on ${format(parseISO(addContext.date), "EEE MMM d")}`
            : ""
        }
      >
        {addContext && (
          <PickRecipe
            onPick={(recipeId) => {
              const ctx = addContext;
              run(
                () =>
                  addMealPlan({
                    date: ctx.date,
                    meal: ctx.meal,
                    recipeId,
                  }),
                { error: "Couldn't add the meal — try again." },
              );
              setAddContext(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function Row({
  meal,
  days,
  mealPlan,
  onAdd,
  onRemove,
  recipes,
}: {
  meal: (typeof MEALS)[number];
  days: { date: string; label: string; short: string }[];
  mealPlan: ReturnType<typeof useAppStore.getState>["mealPlan"];
  onAdd: (date: string) => void;
  onRemove: (id: string) => void;
  recipes: ReturnType<typeof useAppStore.getState>["recipes"];
}) {
  return (
    <>
      <div className="p-3 text-xs uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--border)] flex items-center">
        {meal}
      </div>
      {days.map((d) => {
        const entries = mealPlan.filter(
          (m) => m.date === d.date && m.meal === meal,
        );
        return (
          <div
            key={d.date + meal}
            className="p-2 border-b border-l border-[var(--border)] min-h-[80px] flex flex-col gap-1.5"
          >
            {entries.map((e) => {
              const recipe = recipes.find((r) => r.id === e.recipeId);
              if (!recipe) return null;
              return (
                <div
                  key={e.id}
                  className="text-xs rounded-md bg-[var(--accent-soft)] text-[var(--accent-hover)] px-2 py-1 flex items-start justify-between gap-1 group"
                >
                  <span className="leading-tight">{recipe.name}</span>
                  <button
                    onClick={() => onRemove(e.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => onAdd(d.date)}
              className="mt-auto text-xs text-[var(--text-muted)] hover:text-[var(--accent-hover)] flex items-center justify-center gap-1 py-1 rounded-md hover:bg-[var(--bg)]"
            >
              <Plus className="size-3" /> Add
            </button>
          </div>
        );
      })}
    </>
  );
}

function PickRecipe({ onPick }: { onPick: (id: string) => void }) {
  const recipes = useAppStore((s) => s.recipes);
  const [selected, setSelected] = useState(recipes[0]?.id ?? "");

  if (recipes.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No recipes yet — browse the Explore tab and save a few first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
        {recipes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </Select>
      <div className="flex justify-end gap-2">
        <Button onClick={() => onPick(selected)} disabled={!selected}>
          Add to plan
        </Button>
      </div>
    </div>
  );
}
