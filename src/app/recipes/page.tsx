"use client";

import { useMemo, useState } from "react";
import { ChefHat, Clock, Filter, Plus, Sparkles } from "lucide-react";
import { matchRecipeAgainstPantry, useAppStore } from "@/lib/store";
import { Badge, Button, Card, Input } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { CookMode } from "@/components/cook-mode";
import { useToast } from "@/components/toast";
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

export default function RecipesPage() {
  const recipes = useAppStore((s) => s.recipes);
  const pantry = useAppStore((s) => s.pantry);
  const equipment = useAppStore((s) => s.equipment);
  const toggleEquipment = useAppStore((s) => s.toggleEquipment);
  const generateFromRecipe = useAppStore((s) => s.generateFromRecipe);

  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [cooking, setCooking] = useState<Recipe | null>(null);
  const { toast } = useToast();

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

  return (
    <div>
      <PageHeader
        title="Recipes"
        subtitle="Ranked by how much of each ingredient you already have."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="size-4" /> Filters
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          placeholder="Search recipes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {showFilters && (
        <Card className="mb-4">
          <div className="text-xs text-[var(--text-muted)] mb-2">
            Available equipment
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {EQUIPMENT_OPTS.map((e) => {
              const active = equipment.some((eq) => eq.name === e);
              return (
                <Button
                  key={e}
                  variant={active ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => toggleEquipment(e)}
                >
                  {e}
                </Button>
              );
            })}
          </div>
          <div className="text-xs text-[var(--text-muted)] mb-2">Tags</div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={tag === null ? "primary" : "secondary"}
              size="sm"
              onClick={() => setTag(null)}
            >
              All
            </Button>
            {allTags.map((t) => (
              <Button
                key={t}
                variant={tag === t ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTag(t)}
              >
                {t}
              </Button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ranked.map(({ r, m }) => (
          <RecipeCard
            key={r.id}
            recipe={r}
            have={m.have}
            total={m.total}
            canCook={m.canCook}
            equipmentOk={m.equipmentOk}
            pantry={pantry}
            onAddMissing={() => {
              generateFromRecipe(r.id);
              toast(`Missing ingredients for ${r.name} added to shopping list.`);
            }}
            onCook={() => setCooking(r)}
          />
        ))}
      </div>

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
    <Card id={recipe.id} className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-lg">{recipe.name}</div>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {recipe.description}
          </p>
        </div>
        {canCook ? (
          <Badge tone="fresh">Cook now</Badge>
        ) : (
          <Badge tone="info">
            {have}/{total}
          </Badge>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <Clock className="size-3" /> {recipe.minutes} min
        </span>
        <span>·</span>
        <span className="capitalize">{recipe.difficulty}</span>
        <span>·</span>
        <span>{recipe.servings} servings</span>
        <span>·</span>
        <span>Needs: {recipe.equipment.join(", ")}</span>
        {!equipmentOk && (
          <Badge tone="soon" className="ml-auto">
            Missing equipment
          </Badge>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {recipe.tags.map((t) => (
          <Badge key={t} tone="default">
            {t}
          </Badge>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "View"} recipe
        </Button>
        {canCook ? (
          <Button size="sm" onClick={onCook}>
            <ChefHat className="size-4" /> Cook now
          </Button>
        ) : (
          <Button size="sm" onClick={onAddMissing}>
            <Plus className="size-4" /> Add missing to list
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-4 border-t border-[var(--border)] pt-4 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
              Ingredients
            </div>
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
                      {ing.quantity} {ing.unit} {ing.name}
                      {ing.optional && (
                        <span className="text-[var(--text-muted)]">
                          {" "}
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
                    ) : subs ? (
                      <span className="text-xs text-[var(--text-muted)]">
                        sub: {subs[0]}
                      </span>
                    ) : (
                      <Badge tone="expired">missing</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2 flex items-center gap-1">
              <Sparkles className="size-3" /> Steps
            </div>
            <ol className="space-y-2 text-sm list-decimal pl-5">
              {recipe.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Card>
  );
}
