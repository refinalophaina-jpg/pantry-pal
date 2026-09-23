"use client";

import { useMemo, useState } from "react";
import { FoodVisual } from "@/components/food-visual";
import { Compass, Filter, Plus } from "lucide-react";
import { matchRecipeAgainstPantry, useAppStore } from "@/lib/store";
import { useSyncedActions } from "@/lib/data-sync";
import Link from "next/link";
import { Button, Chip, EmptyState, Input, Segmented } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { CookMode } from "@/components/cook-mode";
import { RecipeDetail } from "@/components/recipe-detail";
import { RecipeEditor, type EditorMode } from "@/components/recipe-editor";
import { useAction } from "@/lib/use-action";
import type { Recipe } from "@/lib/types";

const EQUIPMENT_OPTS = ["pan", "pot", "oven", "wok"];

export default function RecipesPage() {
  const builtins = useAppStore((s) => s.recipes);
  const saved = useAppStore((s) => s.savedRecipes);
  const pantry = useAppStore((s) => s.pantry);
  const equipment = useAppStore((s) => s.equipment);
  const { toggleEquipment, generateFromRecipe, unsaveRecipe } = useSyncedActions();

  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [cooking, setCooking] = useState<Recipe | null>(null);
  const [open, setOpen] = useState<Recipe | null>(null);
  const [editor, setEditor] = useState<EditorMode | null>(null);
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
      .filter(({ r }) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.cuisine.toLowerCase().includes(q.toLowerCase()))
      .filter(({ r }) => !tag || r.tags.includes(tag))
      .sort((a, b) => b.m.score - a.m.score);
  }, [recipes, pantry, equipment, q, tag]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    recipes.forEach((r) => r.tags.forEach((t) => s.add(t)));
    return Array.from(s);
  }, [recipes]);

  const filtersActive = tag !== null || equipment.length > 0;
  const openEditor = (recipe: Recipe) => setEditor(recipe.savedId ? { kind: "edit", recipe } : { kind: "copy", recipe });

  return (
    <div>
      <PageHeader
        title="Recipes"
        subtitle="Your own recipes and the kitchen's, ranked by how much of each you already have."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="size-4" /> Filters{filtersActive ? " · on" : ""}
            </Button>
            <Button size="sm" onClick={() => setEditor({ kind: "new" })}>
              <Plus className="size-4" /> New recipe
            </Button>
          </>
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
              {EQUIPMENT_OPTS.map((e) => (
                <Chip key={e} active={equipment.some((eq) => eq.name === e)} onClick={() => toggleEquipment(e)}>{e}</Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-[var(--text-muted)]">Tags</p>
            <div className="flex flex-wrap gap-2">
              <Chip active={tag === null} onClick={() => setTag(null)}>All</Chip>
              {allTags.map((t) => <Chip key={t} active={tag === t} onClick={() => setTag(t)}>{t}</Chip>)}
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
              ? "Save a dish from Explore, write your own, or copy one of the kitchen's to edit."
              : q || tag
                ? "Try a different search, or clear the filters."
                : "Discover dishes from around the world in Explore."
          }
          action={
            scope === "saved" ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setEditor({ kind: "new" })}><Plus className="size-4" /> New recipe</Button>
                <Link href="/explore"><Button variant="secondary"><Compass className="size-4" /> Explore recipes</Button></Link>
              </div>
            ) : !q && !tag ? (
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
              onAddMissing={() =>
                run(() => generateFromRecipe(r), {
                  success: `Missing ingredients for ${r.name} added to the shopping list.`,
                  error: "Couldn't build the shopping list — try again.",
                })
              }
              onCook={() => setCooking(r)}
              onOpen={() => setOpen(r)}
            />
          ))}
        </div>
      )}

      {open && (
        <RecipeDetail
          key={open.id}
          recipe={open}
          onClose={() => setOpen(null)}
          onCook={(recipe) => { setOpen(null); setCooking(recipe); }}
          onEdit={(recipe) => { setOpen(null); openEditor(recipe); }}
          onDelete={(recipe) => recipe.savedId ? run(() => unsaveRecipe(recipe.savedId!), { success: `${recipe.name} removed from My Recipes.`, error: "Couldn't remove the recipe — try again." }) : Promise.resolve(false)}
        />
      )}
      {cooking && (
        <CookMode recipe={cooking} onClose={() => setCooking(null)} />
      )}
      <RecipeEditor mode={editor} onClose={() => setEditor(null)} />
    </div>
  );
}

function RecipeCard({
  recipe,
  have,
  total,
  canCook,
  equipmentOk,
  onAddMissing,
  onCook,
  onOpen,
}: {
  recipe: Recipe;
  have: number;
  total: number;
  canCook: boolean;
  equipmentOk: boolean;
  onAddMissing: () => void;
  onCook: () => void;
  onOpen: () => void;
}) {
  return (
    <article id={recipe.id} className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <button type="button" onClick={onOpen} className="group flex w-full cursor-pointer items-start gap-3 text-left" aria-label={`Open recipe: ${recipe.name}`}>
        <FoodVisual name={recipe.name} imageUrl={recipe.imageUrl} compact />
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-snug group-hover:text-[var(--accent-hover)]">{recipe.name}</span>
          <span className="mt-0.5 block text-sm text-[var(--text-muted)]">{recipe.description}</span>
        </span>
        {canCook ? (
          <span className="shrink-0 text-sm font-medium text-[var(--fresh)]">Ready</span>
        ) : (
          <span className="shrink-0 text-sm tabular-nums text-[var(--text-muted)]">{have}/{total}</span>
        )}
      </button>

      <p className="mt-3 text-sm text-[var(--text-muted)]">
        {recipe.minutes} min · <span className="capitalize">{recipe.difficulty}</span> · {recipe.servings} servings
        {recipe.cuisine && recipe.cuisine !== "International" && recipe.cuisine !== "Custom" && <> · {recipe.cuisine}</>}
        {recipe.equipment.length > 0 && <> · needs {recipe.equipment.join(", ")}</>}
        {!equipmentOk && <span className="text-[var(--warn)]"> · missing equipment</span>}
        {recipe.tags.length > 0 && <span className="block text-[var(--text-faint)]">{recipe.tags.join(" · ")}</span>}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canCook ? (
          <Button size="sm" onClick={onCook}>Cook now</Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={onAddMissing}>Add missing to list</Button>
        )}
        <span className="text-xs text-[var(--text-faint)]">{recipe.savedId ? "Yours" : "Kitchen recipe"} · open to plan, edit or copy</span>
      </div>
    </article>
  );
}
