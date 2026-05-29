"use client";

import { useEffect, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  ChefHat,
  Clock,
  ExternalLink,
  Flame,
  Globe2,
  PlayCircle,
  Users,
  X,
  Plus,
} from "lucide-react";
import Image from "next/image";
import type { Recipe } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { useSyncedActions } from "@/lib/data-sync";
import { estimateRecipeNutrition, type RecipeNutrition } from "@/lib/nutrition";
import { useToast } from "@/components/toast";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export function RecipeDetail({
  recipe,
  onClose,
  onCook,
}: {
  recipe: Recipe;
  onClose: () => void;
  onCook?: () => void;
}) {
  const pantry = useAppStore((s) => s.pantry);
  const savedRecipes = useAppStore((s) => s.savedRecipes);
  const { saveRecipe, unsaveRecipe, generateFromRecipe } = useSyncedActions();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [nutrition, setNutrition] = useState<RecipeNutrition | null>(null);

  useEffect(() => {
    if (recipe.calories) return; // already computed/saved
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

  const cal = recipe.calories ?? nutrition?.perServing.calories;
  const protein = recipe.proteinG ?? nutrition?.perServing.proteinG;
  const carbs = recipe.carbsG ?? nutrition?.perServing.carbsG;
  const fat = recipe.fatG ?? nutrition?.perServing.fatG;
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
    const owned = pantry.find(
      (p) => p.name.toLowerCase() === ing.name.toLowerCase(),
    );
    return owned && owned.quantity >= ing.quantity;
  }).length;
  const haveTotal = required.length;
  const havePct = haveTotal ? Math.round((haveCount / haveTotal) * 100) : 0;
  const canCookAll = haveTotal > 0 && haveCount === haveTotal;

  // A recipe is "saved" when there's a savedRecipes entry that matches it.
  // We match by externalId first (e.g. MealDB id), then by name.
  const saved = recipe.savedId
    ? recipe
    : savedRecipes.find(
        (r) =>
          (recipe.externalId && r.externalId === recipe.externalId) ||
          r.name.toLowerCase() === recipe.name.toLowerCase(),
      );
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

  async function addMissing() {
    setBusy(true);
    try {
      await generateFromRecipe(recipe.id);
      toast(`Missing ingredients added to shopping list.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "warn");
    }
    setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 size-9 rounded-full bg-black/40 backdrop-blur text-white grid place-items-center hover:bg-black/60 cursor-pointer"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        {recipe.imageUrl ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-t-2xl bg-[var(--bg)]">
            <Image
              src={recipe.imageUrl}
              alt={recipe.name}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6 text-white">
              <h2 className="text-2xl sm:text-3xl font-semibold leading-tight">
                {recipe.name}
              </h2>
              <p className="text-sm text-white/80 mt-1">
                {recipe.description}
              </p>
            </div>
          </div>
        ) : (
          // Recipes without a photo (built-ins) get a warm gradient header so
          // the modal looks intentional rather than a bare text block.
          <div
            className="relative overflow-hidden rounded-t-2xl px-6 sm:px-8 py-10 text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
            }}
          >
            <ChefHat className="absolute -right-3 -bottom-4 size-32 text-white/10" />
            <h2 className="relative text-2xl sm:text-3xl font-semibold leading-tight pr-10">
              {recipe.name}
            </h2>
            <p className="relative text-sm text-white/85 mt-1 max-w-lg">
              {recipe.description}
            </p>
          </div>
        )}

        <div className="p-6 sm:p-8">

          <div className="flex flex-wrap gap-3 text-sm text-[var(--text-muted)] mb-4">
            <Stat icon={<Clock className="size-3.5" />}>
              {recipe.minutes} min
            </Stat>
            <Stat icon={<ChefHat className="size-3.5" />} capitalize>
              {recipe.difficulty}
            </Stat>
            <Stat icon={<Users className="size-3.5" />}>
              {recipe.servings} servings
            </Stat>
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
            <div className="flex flex-wrap gap-1.5 mb-5">
              {recipe.tags.map((t) => (
                <Badge key={t} tone="default">
                  {t}
                </Badge>
              ))}
            </div>
          )}

          {haveTotal > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[var(--text-muted)]">
                  {canCookAll
                    ? "You have everything for this 🎉"
                    : "Ingredients you already have"}
                </span>
                <span className="font-medium">
                  {haveCount} / {haveTotal}
                </span>
              </div>
              <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all"
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
            {onCook && (
              <Button variant="secondary" onClick={onCook}>
                <ChefHat className="size-4" /> Cook now
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

          <Section title="Ingredients">
            <ul className="space-y-1.5 text-sm">
              {recipe.ingredients.map((ing, i) => {
                const owned = pantry.find(
                  (p) => p.name.toLowerCase() === ing.name.toLowerCase(),
                );
                const sufficient = owned && owned.quantity >= ing.quantity;
                return (
                  <li
                    key={`${ing.name}-${i}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>
                      <span className="text-[var(--text-muted)]">
                        {ing.quantity} {ing.unit}
                      </span>{" "}
                      {ing.name}
                      {ing.optional && (
                        <span className="text-[var(--text-muted)] text-xs ml-1">
                          (optional)
                        </span>
                      )}
                    </span>
                    {sufficient ? (
                      <Badge tone="fresh">have</Badge>
                    ) : owned ? (
                      <Badge tone="soon">
                        only {owned.quantity}
                        {owned.unit}
                      </Badge>
                    ) : (
                      <Badge tone="expired">missing</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title="Steps">
            <ol className="space-y-3 text-sm">
              {recipe.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="size-6 shrink-0 rounded-full bg-[var(--accent-soft)] text-[var(--accent-hover)] text-xs font-semibold grid place-items-center">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </Section>

          {(cal || protein || carbs || fat) && (
            <Section title="Per serving">
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
                      className="text-center rounded-lg border border-[var(--border)] p-3"
                    >
                      <div className="text-lg font-semibold">
                        {v}
                        {u}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {label}
                      </div>
                    </div>
                  ))}
              </div>
              {partial && (
                <p className="text-[11px] text-[var(--text-muted)] mt-2">
                  * Estimated from {nutrition?.knownIngredients} of{" "}
                  {nutrition?.totalIngredients} ingredients (built-in
                  nutrition table). Save the recipe to refine later.
                </p>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
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
      <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}
