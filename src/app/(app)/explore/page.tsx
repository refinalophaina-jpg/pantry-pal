"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Search, Shuffle, Globe2 } from "lucide-react";
import {
  searchRecipes,
  randomRecipes,
  SPOONACULAR_CUISINES,
} from "@/lib/spoonacular";
import type { Recipe } from "@/lib/types";
import { Badge, Button, Card, Input } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { RecipeDetail } from "@/components/recipe-detail";
import { useToast } from "@/components/toast";

export default function ExplorePage() {
  const [active, setActive] = useState<string | "discover">("discover");
  const [cards, setCards] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Recipe[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState<Recipe | null>(null);
  const { toast } = useToast();

  // Load discover / cuisine browse whenever the active chip changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSearchResults(null);
    const load =
      active === "discover"
        ? randomRecipes(12)
        : searchRecipes({ cuisine: active, number: 12 });
    load
      .then((r) => {
        if (!cancelled) setCards(r);
      })
      .catch((e) => {
        if (!cancelled) {
          setCards([]);
          setError(
            e instanceof Error ? e.message : "Couldn't load recipes.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  async function onSearch() {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const results = await searchRecipes({ query: q, number: 16 });
      setSearchResults(results);
    } catch (e) {
      setSearchResults([]);
      toast(
        e instanceof Error ? e.message : "Search failed — try again.",
        "warn",
      );
    } finally {
      setSearching(false);
    }
  }

  const shown = searchResults ?? cards;

  return (
    <div>
      <PageHeader
        title="Explore"
        subtitle="Thousands of recipes across every cuisine — with ingredients, steps, and nutrition."
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setActive("discover")}
          >
            <Shuffle className="size-4" /> Surprise me
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            placeholder="Search any dish — e.g. pho, butter chicken, ratatouille…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={onSearch} disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 mb-6 no-scrollbar">
        <Chip
          active={active === "discover" && !searchResults}
          onClick={() => setActive("discover")}
        >
          <Shuffle className="size-3.5" /> Discover
        </Chip>
        {SPOONACULAR_CUISINES.map((c) => (
          <Chip
            key={c}
            active={active === c && !searchResults}
            onClick={() => setActive(c)}
          >
            <Globe2 className="size-3.5" /> {c}
          </Chip>
        ))}
      </div>

      {searchResults && (
        <h2 className="text-sm text-[var(--text-muted)] mb-3">
          {searchResults.length} result{searchResults.length === 1 ? "" : "s"}{" "}
          for &ldquo;{query}&rdquo;
        </h2>
      )}

      {loading ? (
        <Grid>
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </Grid>
      ) : shown.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
            {error
              ? error
              : "No recipes found. Try a different search or cuisine."}
          </p>
        </Card>
      ) : (
        <Grid>
          {shown.map((r) => (
            <RecipeCard key={r.id} recipe={r} onClick={() => setOpen(r)} />
          ))}
        </Grid>
      )}

      {open && <RecipeDetail recipe={open} onClose={() => setOpen(null)} />}
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
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
        active
          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
          : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
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
      className="text-left group rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition-colors cursor-pointer"
    >
      <div className="relative aspect-square overflow-hidden bg-[var(--bg)]">
        {recipe.imageUrl ? (
          <Image
            src={recipe.imageUrl}
            alt={recipe.name}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized
          />
        ) : (
          <div className="grid place-items-center h-full text-[var(--text-muted)]">
            <Globe2 className="size-8" />
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="font-medium text-sm line-clamp-2 group-hover:text-[var(--accent-hover)]">
          {recipe.name}
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {recipe.cuisine && recipe.cuisine !== "International" && (
            <Badge tone="default">{recipe.cuisine}</Badge>
          )}
          <span className="text-xs text-[var(--text-muted)]">
            {recipe.minutes} min
          </span>
        </div>
      </div>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      <div className="aspect-square bg-[var(--bg)] animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-[var(--bg)] rounded animate-pulse" />
        <div className="h-3 bg-[var(--bg)] rounded animate-pulse w-2/3" />
      </div>
    </div>
  );
}
