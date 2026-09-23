"use client";

import { useMemo, useState } from "react";
import { Plus, X, ShoppingCart, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useSyncedActions } from "@/lib/data-sync";
import {
  Button,
  EmptyState,
  Label,
  Modal,
  Select,
} from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { PlanWeekDialog } from "@/components/plan-week";
import { useMounted } from "@/lib/use-mounted";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/toast";
import { format, startOfWeek, addDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

import { FoodVisual } from "@/components/food-visual";
import { RecipeDetail } from "@/components/recipe-detail";
import { CookMode } from "@/components/cook-mode";
import type { Recipe } from "@/lib/types";

const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;

export default function MealPlanPage() {
  const identity = useAppStore((s) => s._identity);
  return <MealPlanContent key={identity} />;
}

function MealPlanContent() {
  const recipes = useAppStore((s) => s.recipes);
  const savedRecipes = useAppStore((s) => s.savedRecipes);
  const mealPlan = useAppStore((s) => s.mealPlan);
  const { addMealPlan, removeMealPlan, moveMealPlan, saveRecipe, generateFromRecipe, buildWeekList } =
    useSyncedActions();
  const run = useAction();
  const { toast } = useToast();

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [cooking, setCooking] = useState<Recipe | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const allRecipes = useMemo(() => Array.from(new Map([...recipes, ...savedRecipes].map(r => [r.id, r])).values()), [recipes, savedRecipes]);
  const isFavorite = (recipe: Recipe) => savedRecipes.some(r => r.id === recipe.id || (recipe.externalId && r.externalId === recipe.externalId) || r.name.toLowerCase() === recipe.name.toLowerCase());
  async function mealAction(action: () => Promise<unknown>, success: string) {
    if (actionBusy) return;
    setActionBusy(true);
    try { await run(action, { success }); } finally { setActionBusy(false); }
  }

  const [weekOffset, setWeekOffset] = useState(0);
  const [addContext, setAddContext] = useState<
    null | { date: string; meal: (typeof MEALS)[number] }
  >(null);

  // Drag-and-drop: id of the entry being dragged, and the slot hovered over.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  function handleDrop(
    e: React.DragEvent,
    date: string,
    meal: (typeof MEALS)[number],
  ) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    setOverKey(null);
    if (!id) return;
    run(() => moveMealPlan(id, { date, meal }), {
      error: "Couldn't move the meal — try again.",
    });
  }

  const [planOpen, setPlanOpen] = useState(false);

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

  const weekLabel = weekStart ? `${format(weekStart, "d MMM")} – ${format(addDays(weekStart, 6), "d MMM")}` : "This week";
  const weekHasMeals = mealPlan.some(entry => days.some(day => day.date === entry.date));

  // Planning starts today when the current week is shown, otherwise on the week's Monday.
  const planStart = weekStart && todayStr ? (weekOffset === 0 && todayStr > format(weekStart, "yyyy-MM-dd") ? todayStr : format(weekStart, "yyyy-MM-dd")) : null;

  const weekButton = "grid size-11 cursor-pointer place-items-center text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]";

  return (
    <div>
      <PageHeader
        title="Meal plan"
        subtitle="Tap a meal for its recipe, servings and cooking. Drag a meal to move it."
        actions={
          <>
            <div role="group" aria-label="Week" className="inline-flex min-h-11 w-full items-center justify-between overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] sm:w-auto">
              <button type="button" aria-label="Previous week" className={weekButton} onClick={() => setWeekOffset((v) => v - 1)}>
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                className="min-w-32 cursor-pointer px-2 text-sm tabular-nums disabled:cursor-default disabled:text-[var(--text)]"
                onClick={() => setWeekOffset(0)}
                disabled={weekOffset === 0}
                title={weekOffset === 0 ? "This week" : "Back to this week"}
              >
                {weekOffset === 0 ? "This week" : weekLabel}
              </button>
              <button type="button" aria-label="Next week" className={weekButton} onClick={() => setWeekOffset((v) => v + 1)}>
                <ChevronRight className="size-4" />
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setPlanOpen(true)} disabled={!mounted}>
              Plan my week
            </Button>
            <Button
              size="sm"
              disabled={actionBusy || !weekHasMeals}
              onClick={() => void mealAction(() => buildWeekList(days.map(day => day.date)), "This week’s missing ingredients added to Shopping.")}
            >
              <ShoppingCart className="size-4" /> {actionBusy ? "Saving…" : "Shop this week"}
            </Button>
          </>
        }
      />

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {!mounted ? (
          <div className="min-w-[800px] space-y-2 p-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="skeleton h-[72px] rounded-md" />
            ))}
          </div>
        ) : (
        <div className="grid min-w-[800px] grid-cols-[96px_repeat(7,minmax(140px,1fr))]">
          <div className="border-b border-[var(--border)] p-3" />
          {days.map((d) => {
            const isToday = d.date === todayStr;
            return (
              <div
                key={d.date}
                className={cn("border-b border-l border-[var(--border)] p-3 text-center", isToday && "bg-[var(--accent-soft)]")}
              >
                <div className="text-xs text-[var(--text-muted)]">{d.label}</div>
                <div className={cn("text-lg tabular-nums", isToday ? "font-medium" : "")}>{d.short}</div>
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
              recipes={allRecipes}
              onOpen={setSelectedRecipe}
              isFavorite={isFavorite}
              actionBusy={actionBusy}
              onFavorite={(recipe) => void mealAction(() => saveRecipe(recipe), "Saved to My Recipes.")}
              onShop={(recipe) => void mealAction(() => generateFromRecipe(recipe, recipe.servings), "Missing ingredients added to Shopping.")}
              dragId={dragId}
              overKey={overKey}
              onDragStartEntry={setDragId}
              onDragEndEntry={() => {
                setDragId(null);
                setOverKey(null);
              }}
              onOver={setOverKey}
              onDrop={handleDrop}
            />
          ))}
        </div>
        )}
      </div>

      {mounted && mealPlan.length === 0 && (
        <div className="mt-4">
          <EmptyState
            title="No meals planned yet"
            description="Tap a slot to add a recipe, or describe the week you want and let the planner fill it from your recipes and the world catalog."
            action={<Button variant="secondary" onClick={() => setPlanOpen(true)}>Plan my week</Button>}
          />
        </div>
      )}

      {selectedRecipe && <RecipeDetail key={selectedRecipe.id} recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} onCook={(recipe) => { setSelectedRecipe(null); setCooking(recipe); }} />}
      {cooking && <CookMode key={cooking.id} recipe={cooking} onClose={() => setCooking(null)} />}

      <Modal
        open={addContext !== null}
        onClose={() => setAddContext(null)}
        title={
          addContext
            ? `Add ${addContext.meal} on ${format(parseISO(addContext.date), "EEE d MMM")}`
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

      {planStart && (
        <PlanWeekDialog
          open={planOpen}
          onClose={() => setPlanOpen(false)}
          start={planStart}
          onPlanned={(count) => toast(`${count} ${count === 1 ? "meal" : "meals"} added to your plan.`)}
        />
      )}
    </div>
  );
}

function Row({
  meal,
  days,
  mealPlan,
  onAdd,
  onRemove,
  onOpen, onFavorite, onShop, isFavorite, actionBusy,
  recipes,
  dragId,
  overKey,
  onDragStartEntry,
  onDragEndEntry,
  onOver,
  onDrop,
}: {
  meal: (typeof MEALS)[number];
  days: { date: string; label: string; short: string }[];
  mealPlan: ReturnType<typeof useAppStore.getState>["mealPlan"];
  onOpen: (recipe: Recipe) => void;
  onFavorite: (recipe: Recipe) => void;
  onShop: (recipe: Recipe) => void;
  isFavorite: (recipe: Recipe) => boolean;
  actionBusy: boolean;
  onAdd: (date: string) => void;
  onRemove: (id: string) => void;
  recipes: ReturnType<typeof useAppStore.getState>["recipes"];
  dragId: string | null;
  overKey: string | null;
  onDragStartEntry: (id: string) => void;
  onDragEndEntry: () => void;
  onOver: (key: string | null) => void;
  onDrop: (
    e: React.DragEvent,
    date: string,
    meal: (typeof MEALS)[number],
  ) => void;
}) {
  const slotButton = "grid size-11 cursor-pointer place-items-center rounded text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] disabled:opacity-50";
  return (
    <>
      <div className="flex items-center border-b border-[var(--border)] p-3 text-sm capitalize text-[var(--text-muted)]">
        {meal}
      </div>
      {days.map((d) => {
        const entries = mealPlan.filter(
          (m) => m.date === d.date && m.meal === meal,
        );
        const key = `${d.date}|${meal}`;
        const isOver = overKey === key && dragId !== null;
        return (
          <div
            key={d.date + meal}
            onDragOver={(e) => {
              if (dragId) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                onOver(key);
              }
            }}
            onDragLeave={() => onOver(null)}
            onDrop={(e) => onDrop(e, d.date, meal)}
            className={cn(
              "flex min-h-[80px] flex-col gap-1.5 border-b border-l p-2 transition-colors",
              isOver ? "border-[var(--terracotta-q)] bg-[var(--accent-soft)]" : "border-[var(--border)]",
            )}
          >
            {entries.map((e) => {
              const recipe = recipes.find((r) => r.id === e.recipeId);
              if (!recipe) return <div key={e.id} className="p-2 text-xs">Recipe unavailable<Button variant="ghost" size="sm" onClick={() => onRemove(e.id)}>Remove meal</Button></div>;
              return (
                <div
                  key={e.id}
                  draggable
                  onDragStart={(ev) => {
                    ev.dataTransfer.setData("text/plain", e.id);
                    ev.dataTransfer.effectAllowed = "move";
                    onDragStartEntry(e.id);
                  }}
                  onDragEnd={onDragEndEntry}
                  className={cn(
                    "group cursor-grab rounded-md border border-[var(--border)] bg-[var(--bg)] p-2 text-xs active:cursor-grabbing",
                    dragId === e.id && "opacity-40",
                  )}
                >
                  <button type="button" onClick={(event) => { event.currentTarget.focus(); onOpen(recipe); }} className="flex min-h-11 w-full items-start gap-2 rounded text-left leading-snug hover:text-[var(--accent-hover)]" aria-label={`Open recipe: ${recipe.name}`}>
                    <FoodVisual name={recipe.name} imageUrl={recipe.imageUrl} compact />
                    <span className="min-w-0">
                      <span className="block font-medium">{recipe.name}</span>
                      <span className="block text-[var(--text-muted)]">{recipe.minutes} min · {recipe.servings} servings</span>
                    </span>
                  </button>
                  <div className="mt-1 flex items-center justify-between border-t border-[var(--border)] pt-1">
                    <button type="button" disabled={actionBusy} onClick={() => onShop(recipe)} aria-label={`Add ingredients for ${recipe.name} to shopping list`} title="Add missing ingredients" className={slotButton}><ShoppingCart className="size-4" /></button>
                    <button type="button" disabled={actionBusy || isFavorite(recipe)} onClick={() => onFavorite(recipe)} aria-label={`${isFavorite(recipe) ? "Favorited" : "Favorite"}: ${recipe.name}`} aria-pressed={isFavorite(recipe)} title={isFavorite(recipe) ? "Saved in My Recipes" : "Save to My Recipes"} className={slotButton}>{isFavorite(recipe) ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}</button>
                    <button type="button" onClick={() => onRemove(e.id)} className={slotButton} aria-label={`Remove ${recipe.name} from plan`}>
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => onAdd(d.date)}
              className="mt-auto flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded-md py-1 text-xs text-[var(--text-faint)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
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
  const builtins = useAppStore((s) => s.recipes);
  const saved = useAppStore((s) => s.savedRecipes);
  const recipes = useMemo(() => Array.from(new Map([...builtins, ...saved].map(r => [r.id, r])).values()), [builtins, saved]);
  const [selected, setSelected] = useState(recipes[0]?.id ?? "");

  if (recipes.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No recipes yet. Browse Explore and save a few first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="pick-recipe">Recipe</Label>
        <Select id="pick-recipe" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button onClick={() => onPick(selected)} disabled={!selected}>
          Add to plan
        </Button>
      </div>
    </div>
  );
}
