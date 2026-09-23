"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe, Search, Shuffle, Sparkles } from "lucide-react";
import { FoodVisual } from "@/components/food-visual";
import { Button, Chip, Input, Label, Modal, SectionTitle, Segmented, Select } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { RecipeDetail } from "@/components/recipe-detail";
import { CookMode } from "@/components/cook-mode";
import { RecipeEditor, type EditorMode } from "@/components/recipe-editor";
import { useToast } from "@/components/toast";
import { useAuth } from "@/lib/auth-context";
import { useAppStore } from "@/lib/store";
import { ApiError } from "@/lib/api-client";
import { cachedExploreCards, cardFromRecipe, cuisineCounts, EXPLORE_CUISINES, exploreSeed, loadExploreCards, resolveCard, searchCards, shuffledCards, uniqueCards, type ExploreCard } from "@/lib/explore-recipes";
import { matchAgainstPantry, rankByPantry, type PantryMatch } from "@/lib/pantry-match";
import { draftDishes, type DraftedDish } from "@/lib/recipe-ai";
import { recipesFromIngredients, searchRecipes as searchWeb } from "@/lib/spoonacular";
import { daysUntil } from "@/lib/utils";
import type { Recipe } from "@/lib/types";

type View = "all" | "pantry" | "kitchen" | string;

export default function ExplorePage() {
  const identity = useAppStore((s) => s._identity);
  return <ExploreContent key={identity} />;
}

function ExploreContent() {
  const pantry = useAppStore((s) => s.pantry);
  const { household } = useAuth();
  const { toast } = useToast();
  const [cards, setCards] = useState<ExploreCard[]>(() => cachedExploreCards());
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("all");
  const [seed, setSeed] = useState(() => exploreSeed());
  const [visible, setVisible] = useState(24);
  const [open, setOpen] = useState<{ recipe: Recipe; note?: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [cooking, setCooking] = useState<Recipe | null>(null);
  const [editor, setEditor] = useState<EditorMode | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftedDish[]>([]);
  const [webCards, setWebCards] = useState<ExploreCard[]>([]);
  const [web, setWeb] = useState<"idle" | "loading" | "unavailable">("idle");

  useEffect(() => {
    let cancelled = false;
    loadExploreCards().then((result) => {
      if (cancelled) return;
      setCards(result.cards);
      setNotice(result.notice);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const pantryNames = useMemo(() => pantry.map((item) => item.name), [pantry]);
  const allCards = useMemo(() => uniqueCards([...drafts.map((draft) => cardFromRecipe(draft.recipe, "draft")), ...cards, ...webCards]), [drafts, cards, webCards]);
  const matches = useMemo(() => {
    const map = new Map<string, PantryMatch<ExploreCard>>();
    if (pantryNames.length) for (const card of allCards) map.set(card.id, matchAgainstPantry(card, pantryNames));
    return map;
  }, [allCards, pantryNames]);
  const fromPantry = useMemo(() => pantryNames.length ? rankByPantry(allCards, pantryNames, { minMatched: 2, limit: 12 }) : [], [allCards, pantryNames]);
  const cuisines = useMemo(() => cuisineCounts(cards).slice(0, 16), [cards]);
  const shuffled = useMemo(() => shuffledCards(cards, seed), [cards, seed]);
  const draftWhy = useMemo(() => new Map(drafts.map((draft) => [draft.recipe.id, draft.why])), [drafts]);

  const results = useMemo(() => {
    const term = query.trim();
    if (view === "pantry") return searchCards(fromPantry.map((match) => match.entry), term);
    if (view === "kitchen") return searchCards(allCards.filter((card) => card.source === "kitchen" || card.source === "curated"), term);
    if (view !== "all") return searchCards(allCards, term, view);
    if (!term) {
      // The pantry section above already shows the top matches; do not repeat them here.
      const shown = new Set(fromPantry.slice(0, 6).map((match) => match.entry.id));
      return uniqueCards([...shuffled, ...webCards]).filter((card) => !shown.has(card.id) && !draftWhy.has(card.id));
    }
    return searchCards(allCards, term);
  }, [view, query, fromPantry, allCards, shuffled, webCards, draftWhy]);

  useEffect(() => { setVisible(24); }, [view, query]);

  async function openCard(card: ExploreCard) {
    if (opening) return;
    setOpening(card.id);
    try { setOpen({ recipe: await resolveCard(card), note: draftWhy.get(card.id) }); }
    catch (error) { toast(error instanceof Error ? error.message : "Could not open this recipe.", "warn"); }
    finally { setOpening(null); }
  }

  async function searchOnline() {
    const term = query.trim();
    setWeb("loading");
    try {
      const found = view === "pantry" || (!term && (view === "all" || view === "kitchen"))
        ? await recipesFromIngredients(pantryNames.slice(0, 20), 12)
        : await searchWeb({ query: term || undefined, cuisine: view !== "all" && view !== "kitchen" && view !== "pantry" ? view : undefined, number: 12 });
      const fresh = found.map((recipe) => cardFromRecipe(recipe, "spoonacular"));
      setWebCards((current) => uniqueCards([...current, ...fresh]));
      toast(fresh.length ? `${fresh.length} recipes found online.` : "Nothing new found online for that.");
      setWeb("idle");
    } catch (error) {
      if (error instanceof ApiError && error.status === 503) { setWeb("unavailable"); toast("Online search is not set up on this server.", "warn"); }
      else { setWeb("idle"); toast(error instanceof Error ? error.message : "Online search failed.", "warn"); }
    }
  }

  const showingPantry = view === "all" && !query.trim();

  return (
    <div>
      <PageHeader
        title="Explore"
        subtitle="Hundreds of dishes from around the world, and what you can cook tonight from your pantry."
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => setDraftOpen(true)} disabled={!household}>
              <Sparkles className="size-4" /> Draft from my pantry
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setQuery(""); setView("all"); setSeed(exploreSeed(true)); }}>
              <Shuffle className="size-4" /> Surprise me
            </Button>
          </>
        }
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-faint)]" aria-hidden="true" />
        <Input
          aria-label="Search recipes"
          placeholder="Search a dish, cuisine or ingredient, e.g. pho, Nigerian, tofu…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-9"
        />
      </div>

      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <Chip active={view === "all"} onClick={() => setView("all")}>All</Chip>
        <Chip active={view === "pantry"} onClick={() => setView("pantry")} disabled={!pantryNames.length} title={pantryNames.length ? undefined : "Add pantry items first"}>From my pantry</Chip>
        <Chip active={view === "kitchen"} onClick={() => setView("kitchen")}>Our Kitchen</Chip>
        {cuisines.map((cuisine) => (
          <Chip key={cuisine.name} active={view === cuisine.name} onClick={() => setView(cuisine.name)}>
            {cuisine.name} <span className={view === cuisine.name ? "opacity-70" : "text-[var(--text-faint)]"}>{cuisine.count}</span>
          </Chip>
        ))}
      </div>

      {notice && <p role="status" className="mb-4 text-sm text-[var(--text-muted)]">{notice}</p>}

      {drafts.length > 0 && showingPantry && (
        <section aria-labelledby="drafts-title" className="mb-8">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <SectionTitle><span id="drafts-title">Drafted from your pantry</span></SectionTitle>
            <button type="button" className="min-h-11 text-sm text-[var(--text-muted)] hover:text-[var(--text)]" onClick={() => setDrafts([])}>Clear drafts</button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {drafts.map((draft) => (
              <li key={draft.recipe.id}>
                <button type="button" onClick={() => void openCard(cardFromRecipe(draft.recipe, "draft"))} className="flex h-full w-full cursor-pointer flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left hover:border-[var(--text-muted)]">
                  <span className="font-medium leading-snug">{draft.recipe.name}</span>
                  <span className="mt-1 text-xs text-[var(--text-muted)]">{draft.recipe.cuisine} · {draft.recipe.minutes} min · {draft.recipe.servings} servings</span>
                  <span className="mt-2 text-sm text-[var(--text-muted)]">{draft.why}</span>
                  {draft.fromPantry.length > 0 && <span className="mt-2 text-xs text-[var(--fresh)]">Uses {draft.fromPantry.slice(0, 5).join(", ")}{draft.fromPantry.length > 5 ? "…" : ""}</span>}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--text-muted)]">Assistant drafts from your pantry list. Open one to save, plan or shop it; nothing is kept until you say so.</p>
        </section>
      )}

      {showingPantry && (
        <section aria-labelledby="pantry-title" className="mb-8">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <SectionTitle><span id="pantry-title">Cook from what you have</span></SectionTitle>
            {fromPantry.length > 6 && <button type="button" className="min-h-11 text-sm text-[var(--text-muted)] hover:text-[var(--text)]" onClick={() => setView("pantry")}>See all {fromPantry.length}</button>}
          </div>
          {!pantryNames.length ? (
            <p className="text-sm text-[var(--text-muted)]">Add a few pantry items and this section ranks every dish by how much of it you already have.</p>
          ) : fromPantry.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No dish matches two or more of your pantry items yet. Try <button type="button" className="underline underline-offset-4" onClick={() => setDraftOpen(true)}>drafting a dish</button> from what you have.</p>
          ) : (
            <Grid>
              {fromPantry.slice(0, 6).map((match) => (
                <RecipeCard key={match.entry.id} card={match.entry} match={match} opening={opening === match.entry.id} onClick={() => void openCard(match.entry)} />
              ))}
            </Grid>
          )}
        </section>
      )}

      {(view !== "all" || query.trim()) && (
        <h2 className="mb-3 text-sm text-[var(--text-muted)]">
          {results.length} {results.length === 1 ? "dish" : "dishes"}
          {query.trim() ? <> for “{query.trim()}”</> : view === "pantry" ? " that use what you have, best match first" : view === "kitchen" ? " from Our Kitchen" : ` from ${view}`}
        </h2>
      )}
      {showingPantry && <SectionTitle className="mb-3">Everything else, in no particular order</SectionTitle>}

      {loading && results.length === 0 ? (
        <Grid>{Array.from({ length: 8 }).map((_, index) => <SkeletonCard key={index} />)}</Grid>
      ) : results.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--text-muted)]">No dish matches. Try another word, or search online below.</p>
      ) : (
        <Grid>
          {results.slice(0, visible).map((card) => (
            <RecipeCard key={card.id} card={card} match={matches.get(card.id)} opening={opening === card.id} onClick={() => void openCard(card)} />
          ))}
        </Grid>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {results.length > visible && <Button variant="secondary" onClick={() => setVisible((count) => count + 24)}>Show 24 more</Button>}
        {web !== "unavailable" && (query.trim() || view !== "all") && (
          <Button variant="secondary" onClick={() => void searchOnline()} disabled={web === "loading" || (view === "pantry" && !pantryNames.length)}>
            <Globe className="size-4" /> {web === "loading" ? "Searching online…" : view === "pantry" ? "Find more online with my pantry" : "Search online"}
          </Button>
        )}
      </div>
      <p className="mt-6 text-xs text-[var(--text-muted)]">
        World recipes are mirrored weekly from <a href="https://www.themealdb.com" target="_blank" rel="noopener noreferrer" className="underline">TheMealDB</a>{webCards.length ? <>; online results via <a href="https://spoonacular.com" target="_blank" rel="noopener noreferrer" className="underline">Spoonacular</a></> : null}. Times and servings are estimates; check measures before you cook.
      </p>

      <Modal open={draftOpen} onClose={() => setDraftOpen(false)} title="Draft dishes from your pantry">
        <DraftForm
          pantry={pantry}
          onDrafted={(list) => { setDrafts(list); setDraftOpen(false); setView("all"); setQuery(""); }}
          householdId={household?.id}
        />
      </Modal>

      {open && <RecipeDetail key={open.recipe.id} recipe={open.recipe} note={open.note} onClose={() => setOpen(null)} onCook={(recipe) => { setOpen(null); setCooking(recipe); }} onEdit={(recipe) => { setOpen(null); setEditor(recipe.savedId ? { kind: "edit", recipe } : { kind: "copy", recipe, keepName: recipe.tags.includes("drafted") }); }} />}
      {cooking && <CookMode recipe={cooking} onClose={() => setCooking(null)} />}
      <RecipeEditor mode={editor} onClose={() => setEditor(null)} />
    </div>
  );
}

function DraftForm({ pantry, householdId, onDrafted }: { pantry: Array<{ id: string; name: string; expiresOn?: string }>; householdId?: string; onDrafted: (drafts: DraftedDish[]) => void }) {
  const { toast } = useToast();
  const [brief, setBrief] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [count, setCount] = useState<"2" | "3" | "4">("3");
  const [focus, setFocus] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const soon = useMemo(() => pantry.filter((item) => { const days = daysUntil(item.expiresOn); return days !== null && days <= 5; }).slice(0, 8), [pantry]);

  async function submit() {
    if (!householdId || busy) return;
    if (!pantry.length) { toast("Add a few pantry items first.", "warn"); return; }
    setBusy(true);
    try {
      const drafts = await draftDishes(householdId, { brief, cuisine, count: Number(count), focus });
      onDrafted(drafts);
      toast(`${drafts.length} ${drafts.length === 1 ? "dish" : "dishes"} drafted.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Drafting failed. Please retry.", "warn");
    } finally { setBusy(false); }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <p className="text-sm text-[var(--text-muted)]">The assistant reads your pantry list ({pantry.length} items) and proposes dishes that use it. You review every draft before saving.</p>
      <div>
        <Label htmlFor="draft-brief">In the mood for (optional)</Label>
        <Input id="draft-brief" value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="e.g. something light, spicy, 30 minutes" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="draft-cuisine">Cuisine</Label>
          <Select id="draft-cuisine" value={cuisine} onChange={(event) => setCuisine(event.target.value)}>
            <option value="">Any</option>
            {EXPLORE_CUISINES.map((name) => <option key={name} value={name}>{name}</option>)}
          </Select>
        </div>
        <div>
          <p className="mb-1 text-sm text-[var(--text-muted)]">How many</p>
          <Segmented label="How many dishes" value={count} onChange={setCount} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} className="w-full" />
        </div>
      </div>
      {soon.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-[var(--text-muted)]">Use up first</p>
          <div className="flex flex-wrap gap-2">
            {soon.map((item) => (
              <Chip key={item.id} active={focus.includes(item.name)} onClick={() => setFocus((list) => list.includes(item.name) ? list.filter((name) => name !== item.name) : [...list, item.name])}>{item.name}</Chip>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={busy || !householdId}>{busy ? "Drafting…" : "Draft dishes"}</Button>
      </div>
    </form>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{children}</div>;
}

function RecipeCard({ card, match, opening, onClick }: { card: ExploreCard; match?: PantryMatch<ExploreCard>; opening: boolean; onClick: () => void }) {
  const showMatch = match && match.have >= 2;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-busy={opening}
      className="group cursor-pointer overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left transition-colors hover:border-[var(--text-muted)] disabled:opacity-60"
    >
      <FoodVisual name={card.name} imageUrl={card.imageUrl} />
      <div className="p-3">
        <div className="line-clamp-2 text-sm font-medium group-hover:text-[var(--accent-hover)]">{card.name}</div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          {card.cuisine && card.cuisine !== "International" ? `${card.cuisine} · ` : ""}{card.source === "themealdb" ? "about " : ""}{card.minutes} min
          {card.source === "draft" ? " · draft" : ""}
        </div>
        {showMatch && (
          <div className={`mt-1 text-xs tabular-nums ${match.coverage >= 0.75 ? "text-[var(--fresh)]" : "text-[var(--text-muted)]"}`}>
            {match.have} of {match.total} in your pantry
          </div>
        )}
        {opening && <div className="mt-1 text-xs text-[var(--text-muted)]">Opening…</div>}
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
