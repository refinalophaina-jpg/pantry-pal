"use client";
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format, addDays } from 'date-fns';
import { Plus, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button, Card, Chip, Input, Modal, SectionTitle, Segmented, Select } from '@/components/ui';
import { RecipeDetail } from '@/components/recipe-detail';
import { CookMode } from '@/components/cook-mode';
import { FoodVisual } from '@/components/food-visual';
import { prepRecipes, prepSessions, prepNotes } from '@/lib/prep-recipes';
import { prepDates, prepBatch } from '@/lib/prep-planner';
import { batchNeeds, PREP_DAY_LABELS, prepOrder, sharedIngredients, templateAssignments, type PrepAssignment, type PrepMeal } from '@/lib/prep-builder';
import { shortfall } from '@/lib/ingredient-math';
import { foodStorage } from '@/lib/food-storage';
import { cachedExploreCards, loadExploreCards, resolveCard, searchCards, type ExploreCard } from '@/lib/explore-recipes';
import { rankByPantry } from '@/lib/pantry-match';
import { useSyncedActions } from '@/lib/data-sync';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/components/toast';
import type { Recipe } from '@/lib/types';

export default function PrepPage() { const identity = useAppStore(s => s._identity); return <PrepContent key={identity} />; }

function PrepContent() {
  const [start, setStart] = useState('');
  const [people, setPeople] = useState(1);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Recipe | null>(null);
  const [cooking, setCooking] = useState<Recipe | null>(null);
  const [batch, setBatch] = useState<PrepAssignment[]>([]);
  const [picking, setPicking] = useState(false);
  const { planPrep, planBatch, buildWeekList } = useSyncedActions();
  const { toast } = useToast();
  const pantry = useAppStore(s => s.pantry);
  const shopping = useAppStore(s => s.shopping);
  const soon = pantry.filter(item => item.expiresOn && item.expiresOn <= format(addDays(new Date(), 3), 'yyyy-MM-dd')).sort((a, b) => a.expiresOn!.localeCompare(b.expiresOn!));
  async function act(task: () => Promise<string>) { if (busy) return; setBusy(true); try { toast(await task()); } catch (e) { toast(e instanceof Error ? e.message : 'Please retry.', 'warn'); } finally { setBusy(false); } }

  const needs = useMemo(() => batch.length ? batchNeeds(batch, people) : [], [batch, people]);
  const toBuy = useMemo(() => shortfall(needs, pantry, shopping), [needs, pantry, shopping]);
  const shared = useMemo(() => sharedIngredients(batch), [batch]);
  const order = useMemo(() => prepOrder(batch), [batch]);
  const portions = batch.reduce((total, item) => total + item.days.length * people, 0);
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof toBuy>();
    for (const item of toBuy) { const key = foodStorage(item.name).category; groups.set(key, [...(groups.get(key) ?? []), item]); }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [toBuy]);

  function addDish(recipe: Recipe) {
    setBatch(list => list.some(item => item.recipe.id === recipe.id) ? list : [...list, { recipe, meal: list.length % 2 === 0 ? 'lunch' : 'dinner', days: [0, 1, 2] }]);
    setPicking(false);
  }
  function update(index: number, patch: Partial<PrepAssignment>) { setBatch(list => list.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  function useTemplate(ids: string[]) { setBatch(templateAssignments(ids.map(id => prepRecipes.find(r => r.id === id)!))); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  return <div>
    <PageHeader title="Three-day prep" subtitle="Cook once, eat well for three days. Build your own batch from any recipe, or start from a template." />
    <Card className="mb-6 space-y-3">
      <SectionTitle>Use the fridge first</SectionTitle>
      <p className="text-sm text-[var(--text-muted)]">Check dated items before choosing the batch. Use-by dates and storage conditions take priority over any plan.</p>
      {soon.length ? <ul className="flex flex-wrap gap-2">{soon.slice(0, 8).map(item => <li key={item.id} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm">{item.name} · {item.expiresOn}</li>)}</ul> : <p className="text-sm">No items with a date in the next three days. Add dates in Pantry to make this useful.</p>}
      <Link className="inline-flex min-h-11 items-center text-sm underline underline-offset-4" href="/pantry/">Review pantry and dates</Link>
    </Card>

    <div className="mb-6 grid gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-sm">First day of this batch<Input aria-label="First day of this batch" type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
      <label className="space-y-2 text-sm">People per meal<Select aria-label="People per meal" value={people} onChange={e => setPeople(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</Select></label>
    </div>

    <section aria-labelledby="batch-title" className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <SectionTitle><span id="batch-title">Your batch</span></SectionTitle>
        <Button variant="secondary" size="sm" onClick={() => setPicking(true)}><Plus className="size-4" /> Add a dish</Button>
      </div>
      {batch.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-5 py-8 text-center">
          <p className="font-medium">No dishes in the batch yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-muted)]">Add any dish: your recipes, the world catalog, prep dishes, or what your pantry can make. Give each one a meal and the days it covers.</p>
          <div className="mt-4 flex justify-center gap-2"><Button onClick={() => setPicking(true)}><Plus className="size-4" /> Add a dish</Button><Button variant="secondary" onClick={() => useTemplate(prepSessions[0].recipes)}>Start from a template</Button></div>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {batch.map((item, index) => (
            <li key={item.recipe.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <FoodVisual name={item.recipe.name} imageUrl={item.recipe.imageUrl} compact />
              <div className="min-w-0 flex-1 basis-48">
                <p className="font-medium leading-snug">{item.recipe.name}</p>
                <p className="text-sm text-[var(--text-muted)]">{item.recipe.minutes} min · {item.days.length * people} {item.days.length * people === 1 ? 'portion' : 'portions'}</p>
              </div>
              <Segmented label={`Meal for ${item.recipe.name}`} value={item.meal} onChange={(meal: PrepMeal) => update(index, { meal })} options={[{ value: 'lunch', label: 'Lunch' }, { value: 'dinner', label: 'Dinner' }]} />
              <div className="flex gap-1" role="group" aria-label={`Days for ${item.recipe.name}`}>
                {PREP_DAY_LABELS.map((label, day) => <Chip key={label} active={item.days.includes(day)} onClick={() => update(index, { days: item.days.includes(day) ? item.days.filter(d => d !== day) : [...item.days, day].sort() })}>{label}</Chip>)}
              </div>
              <button type="button" aria-label={`Remove ${item.recipe.name} from the batch`} className="grid size-11 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]" onClick={() => setBatch(list => list.filter((_, i) => i !== index))}><X className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
      {batch.length > 0 && (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            <SectionTitle as="h3" className="mb-2">Cook in this order</SectionTitle>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">{order.map(step => <li key={step}>{step}</li>)}</ol>
            {shared.length > 0 && <p className="mt-3 text-sm text-[var(--text-muted)]">Shared across dishes: {shared.join(', ')}.</p>}
          </div>
          <div>
            <SectionTitle as="h3" className="mb-2">To buy for {portions} {portions === 1 ? 'portion' : 'portions'}</SectionTitle>
            {toBuy.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Your pantry and shopping list already cover this batch.</p> : (
              <div className="space-y-3">
                {grouped.map(([category, items]) => <div key={category}><p className="text-sm font-medium">{category}</p><p className="text-sm text-[var(--text-muted)]">{items.map(item => `${item.name} ${Math.round(item.quantity * 100) / 100} ${item.unit}`).join(', ')}</p></div>)}
              </div>
            )}
          </div>
        </div>
      )}
      {batch.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button disabled={busy || !start} onClick={() => act(async () => { const count = await planBatch(batch, start, people); return count ? `${count} meals added. Open Meal Plan to review, then shop these dates.` : 'Those slots already have meals. Change the days, meals or start date.'; })}>Plan this batch</Button>
          {!start && <span className="text-sm text-[var(--text-muted)]">Choose the first day to plan.</span>}
        </div>
      )}
    </section>

    <section aria-labelledby="templates-title" className="mb-8">
      <SectionTitle className="mb-1"><span id="templates-title">Templates</span></SectionTitle>
      <p className="mb-4 text-sm text-[var(--text-muted)]">Two small fresh-food shops and two prep sessions cover six lunches and dinners with one flexible day. Use a template as it is, or load it into your batch and change anything.</p>
      <div className="grid gap-5 xl:grid-cols-2">{prepSessions.map(session => <Card key={session.id} className="space-y-4">
        <h3 className="text-lg font-medium">{session.title}</h3><p className="text-sm text-[var(--text-muted)]">{session.shared}</p>
        <div className="grid grid-cols-2 gap-3">{session.recipes.map((id, i) => { const recipe = prepRecipes.find(r => r.id === id)!; return <button key={id} className="cursor-pointer space-y-2 text-left" onClick={() => setOpen(prepBatch(recipe, people))}><FoodVisual name={recipe.name} /><span className="text-xs text-[var(--text-muted)]">{i === 0 ? 'Lunch' : 'Dinner'} · days 1–3</span><span className="block text-sm font-medium">{recipe.name}</span></button>; })}</div>
        <details><summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">View prep order and shopping list</summary><ol className="list-decimal space-y-2 pl-5 text-sm">{session.order.map(step => <li key={step}>{step}</li>)}</ol>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">{(['fresh', 'staples'] as const).map(kind => <div key={kind}><h4 className="text-sm font-medium">{kind === 'fresh' ? 'Fresh · buy for this batch' : 'Cupboard · check before restocking'}</h4><p className="mt-1 text-sm text-[var(--text-muted)]">{Array.from(new Set(session.recipes.flatMap(id => prepNotes[id][kind]))).join(', ')}</p></div>)}</div>
        </details>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !start} onClick={() => act(async () => { const count = await planPrep(session.recipes.map(id => prepRecipes.find(r => r.id === id)!), start, people); return count ? `${count} meals added. Open Meal Plan to review, then shop these dates.` : 'These lunch and dinner slots already have meals. Choose another start date.'; })}>Plan three days</Button>
          <Button variant="secondary" onClick={() => useTemplate(session.recipes)}>Edit in my batch</Button>
        </div>
      </Card>)}</div>
    </section>

    <div className="my-6 flex flex-wrap items-center gap-4">
      <Button variant="secondary" disabled={busy || !start} onClick={() => act(async () => { const count = await buildWeekList(prepDates(start)); return count ? `${count} missing ingredients added for the selected three days.` : 'No missing ingredients to add. Check that these dates have planned meals.'; })}>Shop selected three days</Button>
      <Link href="/meal-plan/" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Open meal plan</Link><Link href="/shopping/" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Open shopping</Link>
    </div>
    <details className="mb-6 rounded-xl border border-[var(--border)] p-5"><summary className="min-h-11 cursor-pointer font-medium">Cool, store and reheat your batch</summary><p className="mt-3 text-sm leading-relaxed">Portion cooked food into shallow containers and refrigerate promptly, within two hours (one hour above 90°F / 32°C). Keep the fridge at 40°F / 4°C or below. Most cooked leftovers keep 3–4 days; freeze portions you will not use in time. Reheat leftovers to 165°F / 74°C. Label containers with the preparation date.</p><p className="mt-3 text-sm">Rice needs extra care: cool quickly, ideally within one hour. For this plan, cook rice fresh or freeze later portions promptly; the UK Food Standards Agency recommends using refrigerated rice within 24 hours. Reheat only the portion you will eat.</p><p className="mt-3 text-xs">Sources: <a className="underline" href="https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety" target="_blank" rel="noreferrer">USDA leftovers guidance</a> · <a className="underline" href="https://www.food.gov.uk/print/pdf/node/4286" target="_blank" rel="noreferrer">FSA rice guidance</a></p></details>
    <SectionTitle className="mb-3">Breakfast and a branch-out bowl</SectionTitle><div className="grid gap-4 sm:grid-cols-2">{prepRecipes.slice(4).map(recipe => <button type="button" className="cursor-pointer space-y-3 rounded-xl border border-[var(--border)] p-4 text-left hover:border-[var(--text-muted)]" key={recipe.id} onClick={() => setOpen(prepBatch(recipe, people))}><FoodVisual name={recipe.name} /><h3 className="font-medium">{recipe.name}</h3><p className="text-sm text-[var(--text-muted)]">{recipe.description}</p></button>)}</div>
    <p className="mt-6 text-xs text-[var(--text-muted)]">Prep dishes are original Pantry Pal kitchen drafts, inspired by these cuisines. Timing is approximate; adjust seasoning and follow package instructions. <Link href="/food-guide/" className="underline">Explore the food & nutrition guide.</Link></p>

    <DishPicker open={picking} onClose={() => setPicking(false)} onPick={addDish} />
    {open && <RecipeDetail key={open.id} recipe={open} onClose={() => setOpen(null)} onCook={r => { setOpen(null); setCooking(r); }} />}{cooking && <CookMode recipe={cooking} onClose={() => setCooking(null)} />}
  </div>;
}

type Source = 'prep' | 'mine' | 'catalog' | 'pantry';

function DishPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (recipe: Recipe) => void }) {
  const savedRecipes = useAppStore(s => s.savedRecipes);
  const recipes = useAppStore(s => s.recipes);
  const pantry = useAppStore(s => s.pantry);
  const { toast } = useToast();
  const [source, setSource] = useState<Source>('prep');
  const [query, setQuery] = useState('');
  const [cards, setCards] = useState<ExploreCard[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const pantryNames = useMemo(() => pantry.map(item => item.name), [pantry]);

  function ensureCatalog() {
    if (cards.length) return;
    setCards(cachedExploreCards());
    loadExploreCards().then(result => setCards(result.cards)).catch(() => {});
  }
  const list = useMemo<Array<{ id: string; name: string; meta: string; pick: () => Promise<Recipe> | Recipe }>>(() => {
    const term = query.trim().toLowerCase();
    const filter = (name: string) => !term || name.toLowerCase().includes(term);
    if (source === 'prep') return prepRecipes.filter(r => filter(r.name)).map(r => ({ id: r.id, name: r.name, meta: `${r.cuisine} · ${r.minutes} min`, pick: () => r }));
    if (source === 'mine') return [...savedRecipes, ...recipes].filter(r => filter(r.name)).map(r => ({ id: r.id, name: r.name, meta: `${r.cuisine} · ${r.minutes} min`, pick: () => r }));
    if (source === 'pantry') return rankByPantry(cards, pantryNames, { minMatched: 2, limit: 20 }).filter(m => filter(m.entry.name)).map(m => ({ id: m.entry.id, name: m.entry.name, meta: `${m.have} of ${m.total} in your pantry · ${m.entry.minutes} min`, pick: () => resolveCard(m.entry) }));
    return searchCards(cards, query).slice(0, 40).map(card => ({ id: card.id, name: card.name, meta: `${card.cuisine} · ${card.minutes} min`, pick: () => resolveCard(card) }));
  }, [source, query, savedRecipes, recipes, cards, pantryNames]);

  async function choose(item: (typeof list)[number]) {
    if (busy) return;
    setBusy(item.id);
    try { onPick(await item.pick()); }
    catch (error) { toast(error instanceof Error ? error.message : 'Could not load that dish.', 'warn'); }
    finally { setBusy(null); }
  }

  return <Modal open={open} onClose={onClose} title="Add a dish to the batch" size="lg">
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      <Segmented label="Dish source" value={source} onChange={(value: Source) => { setSource(value); if (value === 'catalog' || value === 'pantry') ensureCatalog(); }} options={[{ value: 'prep', label: 'Prep dishes' }, { value: 'mine', label: 'My recipes' }, { value: 'catalog', label: 'World catalog' }, { value: 'pantry', label: 'From my pantry' }]} className="w-full sm:w-auto" />
      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-faint)]" aria-hidden="true" /><Input aria-label="Search dishes" className="pl-9" placeholder="Search…" value={query} onChange={e => setQuery(e.target.value)} /></div>
    </div>
    {source === 'pantry' && !pantryNames.length && <p className="text-sm text-[var(--text-muted)]">Add pantry items to see what you can mostly cook already.</p>}
    <ul className="max-h-[50vh] divide-y divide-[var(--border)] overflow-y-auto border-y border-[var(--border)]">
      {list.map(item => <li key={item.id}><button type="button" disabled={Boolean(busy)} onClick={() => void choose(item)} className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 py-2 text-left hover:text-[var(--accent-hover)] disabled:opacity-60"><span className="min-w-0"><span className="block font-medium leading-snug">{item.name}</span><span className="block text-xs text-[var(--text-muted)]">{item.meta}</span></span><span className="shrink-0 text-xs text-[var(--text-muted)]">{busy === item.id ? 'Loading…' : 'Add'}</span></button></li>)}
      {list.length === 0 && <li className="py-6 text-center text-sm text-[var(--text-muted)]">{source === 'catalog' && !cards.length ? 'Loading the catalog…' : 'Nothing matches.'}</li>}
    </ul>
  </Modal>;
}
