"use client";

import { useMemo, useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useSyncedActions } from "@/lib/data-sync";
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
import { useMounted } from "@/lib/use-mounted";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/toast";
import { format, startOfWeek, addDays, parseISO } from "date-fns";

const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;

export default function MealPlanPage() {
  const recipes = useAppStore((s) => s.recipes);
  const savedRecipes = useAppStore((s) => s.savedRecipes);
  const mealPlan = useAppStore((s) => s.mealPlan);
  const { addMealPlan, removeMealPlan, generateMealPlan } = useSyncedActions();
  const run = useAction();
  const { toast } = useToast();

  const [weekOffset, setWeekOffset] = useState(0);
  const [addContext, setAddContext] = useState<
    null | { date: string; meal: (typeof MEALS)[number] }
  >(null);

  // AI generator state
  const [genOpen, setGenOpen] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [prefs, setPrefs] = useState("");
  const [genDays, setGenDays] = useState(7);
  const [genMeals, setGenMeals] = useState<string[]>(["dinner"]);
  const recipeCount = recipes.length + savedRecipes.length;

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

  function toggleGenMeal(m: string) {
    setGenMeals((arr) =>
      arr.includes(m) ? arr.filter((x) => x !== m) : [...arr, m],
    );
  }

  async function generatePlan() {
    if (!weekStart || genMeals.length === 0) return;
    setGenBusy(true);
    try {
      const dates = Array.from({ length: genDays }, (_, i) =>
        format(addDays(weekStart, i), "yyyy-MM-dd"),
      );
      const n = await generateMealPlan({
        dates,
        meals: genMeals,
        preferences: prefs,
      });
      toast(
        n > 0
          ? `Added ${n} meal${n === 1 ? "" : "s"} to your plan.`
          : "Couldn't place any meals — try different preferences.",
        n > 0 ? "success" : "warn",
      );
      if (n > 0) setGenOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Generation failed.", "warn");
    } finally {
      setGenBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Meal plan"
        subtitle="Generate a week with AI, or build it yourself slot by slot."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => setGenOpen(true)} disabled={!mounted}>
              <Sparkles className="size-4" /> Generate
            </Button>
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

      <Modal
        open={genOpen}
        onClose={() => !genBusy && setGenOpen(false)}
        title="Generate a meal plan"
      >
        {recipeCount === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Save a few recipes first (browse Explore) so there&apos;s something
            to plan with.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">
                Preferences (optional)
              </label>
              <Input
                placeholder="e.g. lots of veggies, quick on weeknights, Thai + Italian"
                value={prefs}
                onChange={(e) => setPrefs(e.target.value)}
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-[var(--text-muted)] block mb-1">
                  Span
                </label>
                <Select
                  value={String(genDays)}
                  onChange={(e) => setGenDays(Number(e.target.value))}
                >
                  <option value="7">This week (7 days)</option>
                  <option value="14">Two weeks (14 days)</option>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-[var(--text-muted)] block mb-1">
                  Meals
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MEALS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleGenMeal(m)}
                      className={`rounded-full px-2.5 py-1 text-xs border capitalize transition-colors ${
                        genMeals.includes(m)
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "border-[var(--border)] text-[var(--text-muted)]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Picks from your {recipeCount} recipes, starting the displayed week.
              Up to 10 generations/day.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setGenOpen(false)} disabled={genBusy}>
                Cancel
              </Button>
              <Button
                onClick={generatePlan}
                disabled={genBusy || genMeals.length === 0}
              >
                <Sparkles className="size-4" />
                {genBusy ? "Planning…" : "Generate"}
              </Button>
            </div>
          </div>
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
