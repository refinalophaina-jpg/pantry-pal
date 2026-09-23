"use client";

import { useEffect, useState, useRef, useId } from "react";
import {
  Bookmark,
  BookmarkCheck,
  CalendarPlus,
  ChefHat,
  Clock,
  ExternalLink,
  Flame,
  Globe2,
  Pencil,
  PlayCircle,
  Users,
  X,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { format, addDays } from "date-fns";
import { FoodVisual } from "./food-visual";
import { prepNotes } from "@/lib/prep-recipes";
import type { Recipe } from "@/lib/types";
import { useAppStore, availableQuantity } from "@/lib/store";
import { useSyncedActions } from "@/lib/data-sync";
import { estimateRecipeNutrition, type RecipeNutrition } from "@/lib/nutrition";
import { useToast } from "@/components/toast";
import { Button, Input, Label, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;

/** Tidy a scaled quantity: round to 2 dp and drop trailing zeros (1.5, 2, 0.33). */
function fmtQty(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function RecipeDetail({
  recipe,
  onClose,
  onCook,
  onEdit,
  note,
}: {
  recipe: Recipe;
  onClose: () => void;
  onCook?: (recipe: Recipe) => void;
  /** Opens the editor for a saved recipe, or a copy of any other. */
  onEdit?: (recipe: Recipe) => void;
  /** A short line from whoever suggested this recipe, e.g. why the planner picked it. */
  note?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; if (dialog.current?.showModal) dialog.current.showModal(); else dialog.current?.setAttribute("open", ""); return () => { if(previous?.isConnected) previous.focus(); }; }, []);
  const pantry = useAppStore((s) => s.pantry);
  const savedRecipes = useAppStore((s) => s.savedRecipes);
  const { saveRecipe, unsaveRecipe, generateFromRecipe, ensureSavedRecipe, addMealPlan } = useSyncedActions();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [planDate, setPlanDate] = useState(() => format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [planMeal, setPlanMeal] = useState<(typeof MEALS)[number]>("dinner");
  const drafted = recipe.tags.includes("drafted");
  const viaSpoonacular = /^sp-\d+$/.test(recipe.externalId ?? "") || /^cat-sp-\d+$/.test(recipe.id);
  const [nutrition, setNutrition] = useState<RecipeNutrition | null>(null);

  // Live recipe scaling: adjust servings and ingredient amounts scale with it.
  const baseServings = Math.max(1, recipe.servings || 1);
  const [servings, setServings] = useState(baseServings);
  const scale = servings / baseServings;

  useEffect(() => {
    if (recipe.calories !== undefined) return; // already computed/saved
    let cancelled = false;
    estimateRecipeNutrition(recipe)
      .then((n) => {
        if (!cancelled) setNutrition(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recipe]);

  const cal = recipe.calories ?? (nutrition?.knownIngredients ? nutrition.perServing.calories : undefined);
  const protein = recipe.proteinG ?? (nutrition?.knownIngredients ? nutrition.perServing.proteinG : undefined);
  const carbs = recipe.carbsG ?? (nutrition?.knownIngredients ? nutrition.perServing.carbsG : undefined);
  const fat = recipe.fatG ?? (nutrition?.knownIngredients ? nutrition.perServing.fatG : undefined);
  const notes = prepNotes[recipe.id] ?? Object.entries(prepNotes).find(([id]) => recipe.externalId?.startsWith(id))?.[1];
  const partial =
    !recipe.calories &&
    nutrition &&
    nutrition.knownIngredients < nutrition.totalIngredients;

  // Close on Escape and lock background scroll while the modal is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // How much of this recipe the pantry already covers (non-optional only).
  const required = recipe.ingredients.filter((i) => !i.optional);
  const haveCount = required.filter((ing) => {
    return availableQuantity(pantry, ing.name, ing.unit) >= ing.quantity * scale;
  }).length;
  const haveTotal = required.length;
  const havePct = haveTotal ? Math.round((haveCount / haveTotal) * 100) : 0;
  const canCookAll = haveTotal > 0 && haveCount === haveTotal;

  // A recipe is "saved" when there's a savedRecipes entry that matches it.
  // We match by externalId first (e.g. MealDB id), then by name.
  const saved = savedRecipes.find(r => r.id === recipe.id || (recipe.externalId && r.externalId === recipe.externalId) || r.name.toLowerCase() === recipe.name.toLowerCase());
  const isSaved = !!saved;

  async function toggleSave() {
    setBusy(true);
    try {
      if (isSaved && saved?.savedId) {
        await unsaveRecipe(saved.savedId);
        toast("Removed from your recipes.");
      } else {
        await saveRecipe(recipe);
        toast(`${recipe.name} saved.`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "warn");
    }
    setBusy(false);
  }

  async function addToPlan() {
    if (!planDate) { toast("Choose a date.", "warn"); return; }
    setBusy(true);
    try {
      const recipeId = await ensureSavedRecipe(recipe);
      await addMealPlan({ date: planDate, meal: planMeal, recipeId });
      toast(`${recipe.name} planned for ${planMeal} on ${format(new Date(`${planDate}T12:00:00`), "EEE d MMM")}.`);
      setPlanning(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add to the plan.", "warn");
    }
    setBusy(false);
  }

  async function addMissing() {
    setBusy(true);
    try {
      await generateFromRecipe(recipe, servings);
      toast(`Missing ingredients added to shopping list.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "warn");
    }
    setBusy(false);
  }

  return (
    <dialog ref={dialog} aria-labelledby={titleId} aria-modal="true" onCancel={e=>{e.preventDefault();onClose();}} className="fixed inset-0 z-50 m-0 h-dvh max-h-none w-screen max-w-none bg-black/60 p-4 text-[var(--text)] open:grid open:place-items-center" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 grid size-11 cursor-pointer place-items-center rounded-full bg-black/40 text-white hover:bg-black/60"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        <FoodVisual name={recipe.name} imageUrl={recipe.imageUrl} />
        <div className="px-6 pt-5"><h2 id={titleId} className="font-display pr-10 text-2xl">{recipe.name}</h2><p className="text-sm text-[var(--text-muted)] mt-2">{recipe.description}</p>{note && <p className="mt-2 text-sm text-[var(--text)]">{note}</p>}</div>

        <div className="p-6 sm:p-8">

          <div className="flex flex-wrap gap-3 text-sm text-[var(--text-muted)] mb-4">
            <Stat icon={<Clock className="size-3.5" />}>
              {recipe.minutes} min
            </Stat>
            <Stat icon={<ChefHat className="size-3.5" />} capitalize>
              {recipe.difficulty}
            </Stat>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              <button
                type="button"
                aria-label="Fewer servings"
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                disabled={servings <= 1}
                className="size-11 grid place-items-center rounded border border-[var(--border)] hover:bg-[var(--bg)] disabled:opacity-40 cursor-pointer"
              >
                −
              </button>
              <span className="min-w-[1.5ch] text-center font-medium text-[var(--text)] tabular-nums">
                {servings}
              </span>
              <button
                type="button"
                aria-label="More servings"
                onClick={() => setServings((s) => Math.min(99, s + 1))}
                className="size-11 grid place-items-center rounded border border-[var(--border)] hover:bg-[var(--bg)] cursor-pointer"
              >
                +
              </button>
              servings
              {scale !== 1 && (
                <span className="text-[var(--accent)] text-xs">
                  ·{" "}
                  {scale > 1 ? "scaled up" : "scaled down"}
                </span>
              )}
            </span>
            {recipe.area && (
              <Stat icon={<Globe2 className="size-3.5" />}>{recipe.area}</Stat>
            )}
            {cal ? (
              <Stat icon={<Flame className="size-3.5" />}>
                {cal} kcal{partial && "*"}
              </Stat>
            ) : null}
          </div>

          {recipe.tags.length > 0 && (
            <p className="mb-5 text-sm text-[var(--text-faint)]">{recipe.tags.join(" · ")}</p>
          )}

          {haveTotal > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[var(--text-muted)]">
                  {canCookAll
                    ? "You have everything for this"
                    : "Ingredients you already have"}
                </span>
                <span className="font-medium">
                  {haveCount} / {haveTotal}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full bg-[var(--fresh)] transition-all"
                  style={{ width: `${havePct}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-6">
            <Button onClick={toggleSave} disabled={busy}>
              {isSaved ? (
                <>
                  <BookmarkCheck className="size-4" /> Saved
                </>
              ) : (
                <>
                  <Bookmark className="size-4" /> Save to my recipes
                </>
              )}
            </Button>
            <Button variant="secondary" onClick={addMissing} disabled={busy}>
              <Plus className="size-4" /> Add missing to list
            </Button>
            <Button variant="secondary" onClick={() => setPlanning((value) => !value)} disabled={busy} aria-expanded={planning}>
              <CalendarPlus className="size-4" /> Plan
            </Button>
            {onCook && (
              <Button variant="secondary" onClick={() => onCook({ ...recipe, servings, ingredients: recipe.ingredients.map((ing) => ({ ...ing, quantity: ing.quantity * scale })) })}>
                <ChefHat className="size-4" /> Cook now
              </Button>
            )}
            {onEdit && (
              <Button variant="secondary" onClick={() => onEdit(recipe)} disabled={busy}>
                <Pencil className="size-4" /> {recipe.savedId ? "Edit" : "Copy & edit"}
              </Button>
            )}
            {recipe.video && (
              <a
                href={recipe.video}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--bg)]"
              >
                <PlayCircle className="size-4 text-red-500" /> Watch
              </a>
            )}
            {recipe.source && (
              <a
                href={recipe.source}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--bg)]"
              >
                <ExternalLink className="size-3.5" /> Source
              </a>
            )}
          </div>

          {planning && (
            <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] p-3" onSubmit={(e) => { e.preventDefault(); void addToPlan(); }}>
              <div>
                <Label htmlFor={`${titleId}-date`}>Date</Label>
                <Input id={`${titleId}-date`} type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className="w-44" />
              </div>
              <div>
                <Label htmlFor={`${titleId}-meal`}>Meal</Label>
                <Select id={`${titleId}-meal`} value={planMeal} onChange={(e) => setPlanMeal(e.target.value as (typeof MEALS)[number])} className="w-36 capitalize">
                  {MEALS.map((meal) => <option key={meal} value={meal}>{meal}</option>)}
                </Select>
              </div>
              <Button type="submit" disabled={busy}>Add to plan</Button>
            </form>
          )}
          {drafted && <p className="mb-4 text-sm text-[var(--text-muted)]">Drafted by the assistant from your pantry. Check quantities and cooking times before you rely on them; save it to keep or edit it.</p>}
          {viaSpoonacular && <p className="mb-4 text-xs text-[var(--text-muted)]">Recipe via Spoonacular. Open Source for the original method and measures.</p>}
          <nav aria-label="Recipe connections" className="mb-6 flex flex-wrap gap-4 text-sm text-[var(--text-muted)] underline-offset-4">
            <Link href="/shopping/" onClick={onClose} className="inline-flex min-h-11 items-center hover:text-[var(--text)] hover:underline">Open shopping list</Link>
            <Link href="/pantry/" onClick={onClose} className="inline-flex min-h-11 items-center hover:text-[var(--text)] hover:underline">Check pantry</Link>
            <Link href="/recipes/" onClick={onClose} className="inline-flex min-h-11 items-center hover:text-[var(--text)] hover:underline">My recipes</Link>
          </nav>
          <Section title="Ingredients">
            <ul className="space-y-1.5 text-sm">
              {recipe.ingredients.map((ing, i) => {
                const owned = availableQuantity(pantry, ing.name, ing.unit);
                const sufficient = owned >= ing.quantity * scale;
                return (
                  <li
                    key={`${ing.name}-${i}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>
                      <span className="text-[var(--text-muted)]">
                        {fmtQty(ing.quantity * scale)} {ing.unit}
                      </span>{" "}
                      {ing.name}
                      {ing.optional && (
                        <span className="text-[var(--text-muted)] text-xs ml-1">
                          (optional)
                        </span>
                      )}
                    </span>
                    {sufficient ? (
                      <span className="shrink-0 text-xs text-[var(--fresh)]">have</span>
                    ) : owned ? (
                      <span className="shrink-0 text-xs text-[var(--warn)]">only {fmtQty(owned)} {ing.unit}</span>
                    ) : (
                      <span className="shrink-0 text-xs text-[var(--danger)]">missing</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>

          {notes && <Section title="Make this batch work harder"><details><summary className="min-h-11 cursor-pointer font-medium text-sm">Prep, finishing touches & swaps</summary><div className="space-y-3 text-sm leading-relaxed"><p><strong>Prep:</strong> {notes.prep}</p><p><strong>At serving:</strong> {notes.finish}</p><p><strong>Swap:</strong> {notes.swaps}</p><p><strong>Nutrition:</strong> {notes.nutrition}</p><Link href="/prep/" onClick={onClose} className="underline inline-flex min-h-11 items-center">Batch storage & reheating guidance</Link></div></details></Section>}
          {recipe.externalId && /^\d+$/.test(recipe.externalId) && <p className="text-xs text-[var(--text-muted)] mb-4">TheMealDB recipe. Time, difficulty and four-serving baseline are estimates; check the original source for ingredient measures.</p>}
          <Section title="Steps">
            <ol className="space-y-3 text-sm">
              {recipe.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--bg)] text-xs font-medium tabular-nums text-[var(--text-muted)]">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </Section>

          {(cal !== undefined || nutrition) && (
            <Section title={partial ? "Estimated subtotal per serving" : "Estimated nutrition per serving"}>
              {nutrition?.knownIngredients === 0 && <p className="text-sm">Not enough matched weights to calculate nutrition.</p>}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {[
                  ["Calories", cal, " kcal"],
                  ["Protein", protein, "g"],
                  ["Carbs", carbs, "g"],
                  ["Fat", fat, "g"],
                ]
                  .filter(([, v]) => v != null)
                  .map(([label, v, u]) => (
                    <div
                      key={label as string}
                      className="rounded-lg border border-[var(--border)] p-3 text-center"
                    >
                      <div className="text-lg font-medium tabular-nums">
                        {v}
                        {u}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {label}
                      </div>
                    </div>
                  ))}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-3">{nutrition ? `${nutrition.knownIngredients} of ${nutrition.totalIngredients} required ingredients included. ` : "Recipe-provided values; source methods may vary. "}Optional ingredients and sides are excluded. {partial ? "This subtotal can be substantially below the whole meal; missing values are not zero." : "Actual brands, weights and cooking methods change the result."}</p>
              {!!nutrition?.missingIngredients?.length && <p className="text-xs mt-2">Not counted (unknown match or weight): {nutrition.missingIngredients.join(', ')}.</p>}
              <Link className="text-xs underline inline-flex min-h-11 items-center" href="/food-guide/" onClick={onClose}>Nutrition sources & how estimates work</Link>
            </Section>
          )}
        </div>
      </div>
    </dialog>
  );
}

function Stat({
  icon,
  children,
  capitalize,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  capitalize?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        capitalize && "capitalize",
      )}
    >
      {icon} {children}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="mb-3 text-sm font-medium">
        {title}
      </h3>
      {children}
    </div>
  );
}
