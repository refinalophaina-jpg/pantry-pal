"use client";

import { useEffect, useState } from "react";
import { FoodVisual } from "@/components/food-visual";
import { Search, Shuffle } from "lucide-react";
import { bundledExploreRecipes, EXPLORE_CUISINES, loadExploreRecipes, shuffledRecipes } from "@/lib/explore-recipes";
import type { Recipe } from "@/lib/types";
import { Button, Input } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { RecipeDetail } from "@/components/recipe-detail";
import { CookMode } from "@/components/cook-mode";

export default function ExplorePage() {
  const [visible, setVisible] = useState(24);
  const [selection, setSelection] = useState({ view: "discover", term: "", refresh: 0 });
  const [cards, setCards] = useState<Recipe[]>(() => bundledExploreRecipes());
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Recipe | null>(null);
  const [cooking, setCooking] = useState<Recipe | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVisible(24);
    setLoading(true);
    setNotice(undefined);
    setCards(bundledExploreRecipes(selection.view, selection.term));
    loadExploreRecipes(selection.view, selection.term)
      .then(result => {
        if (cancelled) return;
        setCards(selection.view === "discover" && !selection.term ? shuffledRecipes(result.recipes) : result.recipes);
        setNotice(result.notice);
      })
      .catch(() => {
        if (!cancelled) setNotice("Recipes could not be refreshed. Try again; bundled recipes remain available.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selection]);

  function browse(view: string) {
    setQuery("");
    setSelection(previous => ({ view, term: "", refresh: previous.refresh + 1 }));
  }

  function onSearch() {
    setSelection(previous => ({ ...previous, term: query.trim(), refresh: previous.refresh + 1 }));
  }

  return (
    <div>
      <PageHeader
        title="Explore"
        subtitle="Dishes from Our Kitchen and recipes from around the world."
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => browse("discover")}
          >
            <Shuffle className="size-4" /> Surprise me
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" aria-hidden="true" />
          <Input
            aria-label="Search recipes"
            placeholder="Search a dish, e.g. pho or ratatouille…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={onSearch} disabled={loading}>
          {loading && selection.term ? "Searching…" : "Search"}
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 mb-6 no-scrollbar">
        <Chip
          active={selection.view === "discover" && !selection.term}
          onClick={() => browse("discover")}
        >
          Discover
        </Chip>
        <Chip
          active={selection.view === "kitchen" && !selection.term}
          onClick={() => browse("kitchen")}
        >
          Our Kitchen
        </Chip>
        <Chip active={selection.view === "world" && !selection.term} onClick={() => browse("world")}>
          World recipes
        </Chip>
        {EXPLORE_CUISINES.map((c) => (
          <Chip
            key={c}
            active={selection.view === c && !selection.term}
            onClick={() => browse(c)}
          >
            {c}
          </Chip>
        ))}
      </div>

      {selection.term && (
        <h2 className="mb-3 text-sm text-[var(--text-muted)]">
          {cards.length} result{cards.length === 1 ? "" : "s"}{" "}
          for &ldquo;{selection.term}&rdquo;
        </h2>
      )}

      {notice && <p role="status" className="text-sm text-[var(--text-muted)] mb-4">{notice}</p>}
      {loading && cards.length > 0 && <p className="text-xs text-[var(--text-muted)] mb-3">Refreshing recipes…</p>}
      {(selection.view === "world" || EXPLORE_CUISINES.includes(selection.view) || selection.term) && (
        <p className="text-xs text-[var(--text-muted)] mb-4">World recipes from <a href="https://www.themealdb.com" target="_blank" rel="noopener noreferrer" className="underline">TheMealDB</a>. Cooking times and servings are estimates; review ingredient measures before cooking.</p>
      )}
      {loading && cards.length === 0 ? (
        <Grid>
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </Grid>
      ) : cards.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--text-muted)]">
          No recipes found. Try a different search or cuisine.
        </p>
      ) : (
        <Grid>
          {cards.slice(0, visible).map((r) => (
            <RecipeCard key={r.id} recipe={r} onClick={() => setOpen(r)} />
          ))}
        </Grid>
      )}

      {cards.length > visible && <Button className="mt-5" variant="secondary" onClick={() => setVisible(n => n + 24)}>Show 24 more recipes</Button>}
      {open && <RecipeDetail key={open.id} recipe={open} onClose={() => setOpen(null)} onCook={recipe => { setOpen(null); setCooking(recipe); }} />}
      {cooking && <CookMode recipe={cooking} onClose={() => setCooking(null)} />}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-9 cursor-pointer items-center whitespace-nowrap rounded-full border px-3 text-sm transition-colors ${
        active
          ? "border-[var(--text)] bg-[var(--text)] text-[var(--surface)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {children}
    </div>
  );
}

function RecipeCard({
  recipe,
  onClick,
}: {
  recipe: Recipe;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left transition-colors hover:border-[var(--text-muted)]"
    >
      <FoodVisual name={recipe.name} imageUrl={recipe.imageUrl} />
      <div className="p-3">
        <div className="line-clamp-2 text-sm font-medium group-hover:text-[var(--accent-hover)]">
          {recipe.name}
        </div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          {recipe.cuisine && recipe.cuisine !== "International" ? `${recipe.cuisine} · ` : ""}
          {recipe.id.startsWith("mealdb-") ? "about " : ""}{recipe.minutes} min
        </div>
      </div>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="skeleton aspect-[3/2] rounded-none" />
      <div className="space-y-2 p-3">
        <div className="skeleton h-3" />
        <div className="skeleton h-3 w-2/3" />
      </div>
    </div>
  );
}
