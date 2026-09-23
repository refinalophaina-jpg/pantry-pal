"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { X } from "lucide-react";
import { Button, Chip, Input, Label, Modal, Segmented, Select } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useAuth } from "@/lib/auth-context";
import { useSyncedActions } from "@/lib/data-sync";
import { useAppStore, type PlannedEntry } from "@/lib/store";
import { fetchCatalogRecipe, loadRecipeIndex, readCachedIndex, type CatalogEntry } from "@/lib/catalog-index";
import { draftDishes } from "@/lib/recipe-ai";
import { candidatePool, composeBrief, CUISINE_GROUPS, WEEK_MOODS, type PlanCandidate } from "@/lib/week-brief";
import type { MealPlanEntry, Recipe } from "@/lib/types";

const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
type Meal = (typeof MEALS)[number];
const SPANS = [{ value: "3", label: "3 days" }, { value: "5", label: "5 days" }, { value: "7", label: "Week" }, { value: "14", label: "Two weeks" }];

/**
 * Plan my week: a few taps describe the week, the planner fills only the
 * empty slots from the household's recipes, the catalog and optional drafts,
 * and nothing lands on the calendar until the preview is accepted.
 */
export function PlanWeekDialog({ open, onClose, start, onPlanned }: { open: boolean; onClose: () => void; start: string; onPlanned: (count: number) => void }) {
  const { household } = useAuth();
  const { toast } = useToast();
  const recipes = useAppStore((s) => s.recipes);
  const savedRecipes = useAppStore((s) => s.savedRecipes);
  const pantry = useAppStore((s) => s.pantry);
  const mealPlan = useAppStore((s) => s.mealPlan);
  const { generateMealPlan, commitMealPlan, ensureSavedRecipe } = useSyncedActions();
  const [moods, setMoods] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [span, setSpan] = useState("7");
  const [meals, setMeals] = useState<Meal[]>(["dinner"]);
  const [useCatalog, setUseCatalog] = useState(true);
  const [useDrafts, setUseDrafts] = useState(false);
  const [index, setIndex] = useState<CatalogEntry[]>(() => readCachedIndex() ?? []);
  const [stage, setStage] = useState<"brief" | "preview">("brief");
  const [busy, setBusy] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<PlanCandidate[]>([]);
  const [entries, setEntries] = useState<PlannedEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    setStage("brief"); setEntries([]); setBusy(null);
    let cancelled = false;
    loadRecipeIndex().then((list) => { if (!cancelled) setIndex(list); }).catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  const own = useMemo(() => Array.from(new Map([...savedRecipes, ...recipes].map((recipe) => [recipe.name.toLowerCase(), recipe])).values()), [savedRecipes, recipes]);
  const available = useMemo(() => {
    const names = new Set([...index.map((entry) => entry.cuisine), ...own.map((recipe) => recipe.cuisine)]);
    return CUISINE_GROUPS.map((group) => ({ ...group, cuisines: group.cuisines.filter((cuisine) => names.has(cuisine)) })).filter((group) => group.cuisines.length);
  }, [index, own]);
  const dates = useMemo(() => Array.from({ length: Number(span) }, (_, offset) => format(addDays(parseISO(start), offset), "yyyy-MM-dd")), [start, span]);
  const emptySlots = useMemo(() => dates.flatMap((date) => meals.filter((meal) => !mealPlan.some((entry) => entry.date === date && entry.meal === meal)).map((meal) => ({ date, meal }))), [dates, meals, mealPlan]);
  const brief = composeBrief({ moods, cuisines, notes });

  function toggle<T>(list: T[], value: T) { return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]; }

  async function plan() {
    if (!household || busy) return;
    if (!emptySlots.length) { toast("Every chosen slot already has a meal. Pick other meals or days.", "warn"); return; }
    setBusy("Reading your recipes…");
    try {
      let drafts: Recipe[] = [];
      if (useDrafts && pantry.length) {
        setBusy("Drafting dishes from your pantry…");
        drafts = (await draftDishes(household.id, { brief, cuisine: cuisines.length === 1 ? cuisines[0] : "", count: 3 })).map((draft) => draft.recipe);
      }
      const pool = candidatePool({ own, drafts, index, pantryNames: pantry.map((item) => item.name), cuisines, includeCatalog: useCatalog, limit: 120 });
      if (!pool.length) throw new Error("Nothing to plan with. Save a recipe, include the catalog, or pick other cuisines.");
      setCandidates(pool);
      setBusy(`Planning ${emptySlots.length} meals…`);
      const planned = await generateMealPlan({ dates: [...new Set(emptySlots.map((slot) => slot.date))], meals: [...new Set(emptySlots.map((slot) => slot.meal))], brief, candidates: pool });
      const wanted = new Set(emptySlots.map((slot) => `${slot.date}:${slot.meal}`));
      setEntries(planned.filter((entry) => wanted.has(`${entry.date}:${entry.meal}`)));
      setStage("preview");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Planning failed. Please retry.", "warn");
    } finally { setBusy(null); }
  }

  async function accept() {
    if (busy || !entries.length) return;
    try {
      const resolved: Array<{ date: string; meal: Meal; recipeId: string; recipeName: string }> = [];
      const ids = new Map<string, string>();
      let done = 0;
      for (const entry of entries) {
        setBusy(`Saving recipes ${++done} of ${entries.length}…`);
        let recipeId = ids.get(entry.candidate.id);
        if (!recipeId) {
          const recipe = entry.candidate.recipe ?? (entry.candidate.entry ? await fetchCatalogRecipe(entry.candidate.entry.slug) : null);
          if (!recipe) throw new Error(`${entry.candidate.name} is no longer available. Swap it and try again.`);
          recipeId = await ensureSavedRecipe(recipe);
          ids.set(entry.candidate.id, recipeId);
        }
        resolved.push({ date: entry.date, meal: entry.meal, recipeId, recipeName: entry.candidate.name });
      }
      setBusy("Adding to your plan…");
      const count = await commitMealPlan(resolved);
      onPlanned(count);
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not add the plan.", "warn");
    } finally { setBusy(null); }
  }

  const byDate = useMemo(() => {
    const groups = new Map<string, PlannedEntry[]>();
    for (const entry of [...entries].sort((a, b) => a.date.localeCompare(b.date) || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal))) groups.set(entry.date, [...(groups.get(entry.date) ?? []), entry]);
    return [...groups.entries()];
  }, [entries]);

  return (
    <Modal open={open} onClose={() => { if (!busy) onClose(); }} title={stage === "brief" ? "Plan my week" : "Your plan, before it lands"} size="lg">
      {stage === "brief" ? (
        <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void plan(); }}>
          <div>
            <p className="mb-2 text-sm text-[var(--text-muted)]">What kind of week?</p>
            <div className="flex flex-wrap gap-2">
              {WEEK_MOODS.map((mood) => <Chip key={mood.id} active={moods.includes(mood.id)} onClick={() => setMoods((list) => toggle(list, mood.id))}>{mood.label}</Chip>)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-[var(--text-muted)]">Cuisines <span className="text-[var(--text-faint)]">· leave empty for a mix</span></p>
            <div className="space-y-2">
              {available.map((group) => (
                <div key={group.label} className="flex flex-wrap items-center gap-2">
                  <span className="w-28 shrink-0 text-xs text-[var(--text-faint)]">{group.label}</span>
                  {group.cuisines.map((cuisine) => <Chip key={cuisine} active={cuisines.includes(cuisine)} onClick={() => setCuisines((list) => toggle(list, cuisine))}>{cuisine}</Chip>)}
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="plan-notes">Anything else?</Label>
            <Input id="plan-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. no pork, partner is away Thursday, use the tofu" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-sm text-[var(--text-muted)]">From {format(parseISO(start), "EEE d MMM")}</p>
              <Segmented label="How many days" value={span} onChange={setSpan} options={SPANS} className="w-full" />
            </div>
            <div>
              <p className="mb-1 text-sm text-[var(--text-muted)]">Meals</p>
              <div className="flex flex-wrap gap-1.5">
                {MEALS.map((meal) => <Chip key={meal} active={meals.includes(meal)} onClick={() => setMeals((list) => toggle(list, meal))} className="capitalize">{meal}</Chip>)}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <span className="text-[var(--text-muted)]">Plan from:</span>
            <span className="inline-flex items-center gap-1.5">My recipes ({own.length})</span>
            <label className="inline-flex cursor-pointer items-center gap-1.5"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={useCatalog} onChange={(event) => setUseCatalog(event.target.checked)} /> World catalog ({index.length})</label>
            <label className="inline-flex cursor-pointer items-center gap-1.5"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={useDrafts} onChange={(event) => setUseDrafts(event.target.checked)} disabled={!pantry.length} /> Assistant drafts from my pantry</label>
          </div>
          <p className="text-sm text-[var(--text-muted)]">{emptySlots.length} empty {emptySlots.length === 1 ? "slot" : "slots"} to fill. Meals already on the calendar stay where they are.</p>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={Boolean(busy)}>Cancel</Button>
            <Button type="submit" disabled={Boolean(busy) || !meals.length || !emptySlots.length}>{busy ?? `Plan ${emptySlots.length} meals`}</Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">Swap or remove anything, then add the rest to your calendar. Catalog dishes are saved to My Recipes when you accept.</p>
          <ol className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {byDate.map(([date, list]) => (
              <li key={date} className="py-2">
                <p className="mb-1 text-sm font-medium">{format(parseISO(date), "EEEE d MMM")}</p>
                <ul className="space-y-1.5">
                  {list.map((entry) => (
                    <li key={`${entry.date}:${entry.meal}`} className="grid grid-cols-[72px_1fr_auto] items-start gap-2 text-sm">
                      <span className="pt-2.5 capitalize text-[var(--text-muted)]">{entry.meal}</span>
                      <div className="min-w-0">
                        <Select aria-label={`Recipe for ${entry.meal} on ${date}`} value={entry.candidate.id} onChange={(event) => {
                          const next = candidates.find((candidate) => candidate.id === event.target.value);
                          if (next) setEntries((current) => current.map((item) => item === entry ? { ...item, candidate: next, why: undefined } : item));
                        }}>
                          {candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.cuisine && candidate.cuisine !== "International" ? ` · ${candidate.cuisine}` : ""} · {candidate.minutes} min</option>)}
                        </Select>
                        {entry.why && <p className="mt-1 text-xs text-[var(--text-muted)]">{entry.why}</p>}
                      </div>
                      <button type="button" aria-label={`Remove ${entry.candidate.name}`} className="grid size-11 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]" onClick={() => setEntries((current) => current.filter((item) => item !== entry))}>
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          {entries.length === 0 && <p className="text-sm text-[var(--text-muted)]">Nothing left to add.</p>}
          <div className="flex flex-wrap justify-between gap-2 border-t border-[var(--border)] pt-4">
            <Button type="button" variant="ghost" onClick={() => setStage("brief")} disabled={Boolean(busy)}>Change the brief</Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => void plan()} disabled={Boolean(busy)}>Plan again</Button>
              <Button type="button" onClick={() => void accept()} disabled={Boolean(busy) || !entries.length}>{busy ?? `Add ${entries.length} meals`}</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export type { MealPlanEntry };
