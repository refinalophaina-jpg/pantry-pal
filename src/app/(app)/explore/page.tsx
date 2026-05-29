"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Search, Shuffle, Globe2 } from "lucide-react";
import {
  filterByArea,
  listAreas,
  lookupMeal,
  randomMeals,
  searchByName,
  type MealDBCardItem,
} from "@/lib/mealdb";
import type { Recipe } from "@/lib/types";
import { Badge, Button, Card, Input } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { RecipeDetail } from "@/components/recipe-detail";
import { useToast } from "@/components/toast";

// Curated short-list of the most cooked cuisines; full list comes from the API.
const FEATURED = [
  "Italian",
  "Mexican",
  "Indian",
  "Chinese",
  "Japanese",
  "Thai",
  "French",
  "Greek",
  "Moroccan",
  "American",
  "British",
  "Vietnamese",
];

type CardWithMeta = MealDBCardItem & { area?: string };

export default function ExplorePage() {
  const [areas, setAreas] = useState<string[]>([]);
  const [active, setActive] = useState<string | "discover">("discover");
  const [cards, setCards] = useState<CardWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Recipe[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState<Recipe | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    listAreas().then(setAreas).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setSearchResults(null);
    if (active === "discover") {
      randomMeals(12)
        .then((r) =>
          setCards(
            r.map((rec) => ({
              idMeal: rec.externalId!,
              strMeal: rec.name,
              strMealThumb: rec.imageUrl ?? "",
              area: rec.area,
            })),
          ),
        )
        .catch(() => setCards([]))
        .finally(() => setLoading(false));
    } else {
      filterByArea(active)
        .then((r) =>
          setCards(r.map((c) => ({ ...c, area: active }))),
        )
        .catch(() => setCards([]))
        .finally(() => setLoading(false));
    }
  }, [active]);

  async function onSearch() {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const results = await searchByName(q);
      setSearchResults(results);
    } catch {
      // Surface the failure instead of silently snapping back to the grid.
      setSearchResults([]);
      toast("Search failed — check your connection and try again.", "warn");
    } finally {
      setSearching(false);
    }
  }

  async function openCard(id: string) {
    const recipe = await lookupMeal(id);
    if (recipe) setOpen(recipe);
  }

  const visibleCards = useMemo(() => cards, [cards]);

  return (
    <div>
      <PageHeader
        title="Explore"
        subtitle="Cook across cultures — recipes from TheMealDB, with images and videos."
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
            placeholder="Search dishes — e.g. arrabiata, tagine, ramen…"
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
          active={active === "discover"}
          onClick={() => setActive("discover")}
        >
          <Shuffle className="size-3.5" /> Discover
        </Chip>
        {(areas.length > 0 ? areas : FEATURED).map((a) => (
          <Chip key={a} active={active === a} onClick={() => setActive(a)}>
            <Globe2 className="size-3.5" /> {a}
          </Chip>
        ))}
      </div>

      {searchResults ? (
        <>
          <h2 className="text-sm text-[var(--text-muted)] mb-3">
            {searchResults.length} result{searchResults.length === 1 ? "" : "s"}{" "}
            for &ldquo;{query}&rdquo;
          </h2>
          <Grid>
            {searchResults.map((r) => (
              <RecipeCard
                key={r.id}
                title={r.name}
                area={r.area}
                image={r.imageUrl}
                onClick={() => setOpen(r)}
              />
            ))}
          </Grid>
        </>
      ) : loading ? (
        <Grid>
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </Grid>
      ) : visibleCards.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-sm text-[var(--text-muted)]">
            Nothing here yet. Try another cuisine, or hit Surprise me.
          </p>
        </Card>
      ) : (
        <Grid>
          {visibleCards.map((c) => (
            <RecipeCard
              key={c.idMeal}
              title={c.strMeal}
              area={c.area}
              image={c.strMealThumb}
              onClick={() => openCard(c.idMeal)}
            />
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
  title,
  area,
  image,
  onClick,
}: {
  title: string;
  area?: string;
  image?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left group rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden hover:border-[var(--accent)] transition-colors cursor-pointer"
    >
      <div className="relative aspect-square overflow-hidden bg-[var(--bg)]">
        {image ? (
          <Image
            src={image}
            alt={title}
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
          {title}
        </div>
        {area && (
          <Badge tone="default" className="mt-2">
            {area}
          </Badge>
        )}
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
