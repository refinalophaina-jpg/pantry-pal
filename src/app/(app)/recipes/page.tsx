"use client";

import { useMemo, useState } from "react";
import { FoodVisual } from "@/components/food-visual";
import { Compass, Filter } from "lucide-react";
import { matchRecipeAgainstPantry, useAppStore } from "@/lib/store";
import { useSyncedActions } from "@/lib/data-sync";
import Link from "next/link";
import { Button, EmptyState, Input, Segmented } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { CookMode } from "@/components/cook-mode";
import { useAction } from "@/lib/use-action";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/lib/types";

const EQUIPMENT_OPTS = ["pan", "pot", "oven", "wok"];

const SUBSTITUTIONS: Record<string, string[]> = {
  "olive oil": ["butter", "avocado oil", "vegetable oil"],
  parmesan: ["pecorino", "grana padano", "nutritional yeast"],
  "soy sauce": ["tamari", "coconut aminos", "fish sauce + salt"],
  spinach: ["kale", "swiss chard", "arugula"],
  rice: ["quinoa", "cauliflower rice", "couscous"],
  spaghetti: ["linguine", "fettuccine", "rice noodles"],
};

const chipClass = (active: boolean) =>
  cn(
    "min-h-9 cursor-pointer rounded-full border px-3 text-sm transition-colors",
    active
      ? "border-[var(--text)] bg-[var(--text)] text-[var(--surface)]"
      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text)]",
  );

export default function RecipesPage() {
  const builtins = useAppStore((s) => s.recipes);
  const saved = useAppStore((s) => s.savedRecipes);
  const pantry = useAppStore((s) => s.pantry);
  const equipment = useAppStore((s) => s.equipment);
  const { toggleEquipment, generateFromRecipe } = useSyncedActions();

  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [cooking, setCooking] = useState<Recipe | null>(null);
  const [scope, setScope] = useState<"all" | "saved">("all");
  const run = useAction();

  const recipes = useMemo(() => {
    // Saved recipes first; then built-ins deduped by name match.
    const savedNames = new Set(saved.map((r) => r.name.toLowerCase()));
    if (scope === "saved") return saved;
    return [
      ...saved,
      ...builtins.filter((r) => !savedNames.has(r.name.toLowerCase())),
    ];
  }, [builtins, saved, scope]);

  const ranked = useMemo(() => {
    return recipes
      .map((r) => ({ r, m: matchRecipeAgainstPantry(r, pantry, equipment) }))
      .filter(({ r }) => !q || r.name.toLowerCase().includes(q.toLowerCase()))
      .filter(({ r }) => !tag || r.tags.includes(tag))
      .sort((a, b) => b.m.score - a.m.score);
  }, [recipes, pantry, equipment, q, tag]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    recipes.forEach((r) => r.tags.forEach((t) => s.add(t)));
    return Array.from(s);
  }, [recipes]);

  const filtersActive = tag !== null || equipment.length > 0;

  return (
    <div>
      <PageHeader
        title="Recipes"
        subtitle="Ranked by how much of each recipe you already have."
        actions={
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="size-4" /> Filters{filtersActive ? " · on" : ""}
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Search recipes"
          placeholder="Search recipes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1"
        />
        <Segmented
          label="Which recipes"
          value={scope}
          onChange={setScope}
          options={[
            { value: "all", label: "All" },
            { value: "saved", label: `Saved (${saved.length})` },
          ]}
        />
      </div>

      {showFilters && (
        <div className="mb-6 space-y-4 rounded-xl border border-[var(--border)] p-4">
          <div>
            <p className="mb-2 text-sm text-[var(--text-muted)]">Equipment you have</p>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTS.map((e) => {
                const active = equipment.some((eq) => eq.name === e);
                return (
                  <button key={e} type="button" aria-pressed={active} className={chipClass(active)} onClick={() => toggleEquipment(e)}>
                    {e}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-[var(--text-muted)]">Tags</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={tag === null} className={chipClass(tag === null)} onClick={() => setTag(null)}>
                All
              </button>
              {allTags.map((t) => (
                <button key={t} type="button" aria-pressed={tag === t} className={chipClass(tag === t)} onClick={() => setTag(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {ranked.length === 0 ? (
        <EmptyState
          title={
            scope === "saved"
              ? "No saved recipes yet"
              : q || tag
                ? "No recipes match"
                : "No recipes yet"
          }
          description={
            scope === "saved"
              ? "Browse Explore and tap the bookmark to save recipes here."
              : q || tag
                ? "Try a different search, or clear the filters."
                : "Discover dishes from around the world in Explore."
          }
          action={
            scope === "saved" || (!q && !tag) ? (
              <Link href="/explore">
                <Button>
                  <Compass className="size-4" /> Explore recipes
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ranked.map(({ r, m }) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              have={m.have}
              total={m.total}
              canCook={m.canCook}
              equipmentOk={m.equipmentOk}
              pantry={pantry}
              onAddMissing={() =>
                run(() => generateFromRecipe(r), {
                  success: `Missing ingredients for ${r.name} added to the shopping list.`,
                  error: "Couldn't build the shopping list — try again.",
                })
              }
              onCook={() => setCooking(r)}
            />
          ))}
        </div>
      )}

      {cooking && (
        <CookMode recipe={cooking} onClose={() => setCooking(null)} />
      )}
    </div>
  );
}

function RecipeCard({
  recipe,
  have,
  total,
  canCook,
  equipmentOk,
  pantry,
  onAddMissing,
  onCook,
}: {
  recipe: Recipe;
  have: number;
  total: number;
  canCook: boolean;
  equipmentOk: boolean;
  pantry: ReturnType<typeof useAppStore.getState>["pantry"];
  onAddMissing: () => void;
  onCook: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article id={recipe.id} className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <FoodVisual name={recipe.name} imageUrl={recipe.imageUrl} compact />
        <div className="min-w-0 flex-1">
          <h2 className="font-medium leading-snug">{recipe.name}</h2>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">{recipe.description}</p>
        </div>
        {canCook ? (
          <span className="shrink-0 text-sm font-medium text-[var(--fresh)]">Ready</span>
        ) : (
          <span className="shrink-0 text-sm tabular-nums text-[var(--text-muted)]">{have}/{total}</span>
        )}
      </div>

      <p className="mt-3 text-sm text-[var(--text-muted)]">
        {recipe.minutes} min · <span className="capitalize">{recipe.difficulty}</span> · {recipe.servings} servings
        {recipe.equipment.length > 0 && <> · needs {recipe.equipment.join(", ")}</>}
        {!equipmentOk && <span className="text-[var(--warn)]"> · missing equipment</span>}
        {recipe.tags.length > 0 && <span className="block text-[var(--text-faint)]">{recipe.tags.join(" · ")}</span>}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {canCook ? (
          <Button size="sm" onClick={onCook}>
            Cook now
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={onAddMissing}>
            Add missing to list
          </Button>
        )}
        <Button variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "View"} recipe
        </Button>
      </div>

      {open && (
        <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
          <div>
            <h3 className="mb-2 text-sm font-medium">Ingredients</h3>
            <ul className="space-y-1.5 text-sm">
              {recipe.ingredients.map((ing) => {
                const owned = pantry.find(
                  (p) => p.name.toLowerCase() === ing.name.toLowerCase(),
                );
                const sufficient = owned && owned.quantity >= ing.quantity;
                const subs = SUBSTITUTIONS[ing.name.toLowerCase()];
                return (
                  <li
                    key={ing.name}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>
                      <span className="text-[var(--text-muted)]">{ing.quantity} {ing.unit}</span> {ing.name}
                      {ing.optional && (
                        <span className="text-[var(--text-muted)]"> (optional)</span>
                      )}
                    </span>
                    {sufficient ? (
                      <span className="shrink-0 text-xs text-[var(--fresh)]">have</span>
                    ) : owned ? (
                      <span className="shrink-0 text-xs text-[var(--warn)]">only {owned.quantity}{owned.unit}</span>
                    ) : subs ? (
                      <span className="shrink-0 text-xs text-[var(--text-muted)]">or {subs[0]}</span>
                    ) : (
                      <span className="shrink-0 text-xs text-[var(--danger)]">missing</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Steps</h3>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {recipe.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </article>
  );
}
