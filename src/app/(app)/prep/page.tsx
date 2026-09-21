"use client";
import { useState } from 'react';
import Link from 'next/link';
import { format, addDays } from 'date-fns';
import { PageHeader } from '@/components/page-header';
import { Button, Card, Input, Select } from '@/components/ui';
import { RecipeDetail } from '@/components/recipe-detail';
import { CookMode } from '@/components/cook-mode';
import { FoodVisual } from '@/components/food-visual';
import { prepRecipes, prepSessions, prepNotes } from '@/lib/prep-recipes';
import { prepDates, prepBatch } from '@/lib/prep-planner';
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
  const { planPrep, buildWeekList } = useSyncedActions();
  const { toast } = useToast();
  const pantry = useAppStore(s => s.pantry);
  const soon = pantry.filter(item => item.expiresOn && item.expiresOn <= format(addDays(new Date(), 3), 'yyyy-MM-dd')).sort((a,b) => a.expiresOn!.localeCompare(b.expiresOn!));
  async function act(task: () => Promise<string>) { if (busy) return; setBusy(true); try { toast(await task()); } catch (e) { toast(e instanceof Error ? e.message : 'Please retry.', 'warn'); } finally { setBusy(false); } }
  return <div>
    <PageHeader title="Three-day prep" subtitle="Two small fresh-food shops. Two prep sessions. Six days of lunches and dinners, with one flexible day." />
    <Card className="mb-6 space-y-3">
      <h2 className="font-semibold">Use the fridge first</h2>
      <p className="text-sm text-[var(--text-muted)]">Check dated items before choosing your next batch. Use-by dates and storage conditions take priority over the plan.</p>
      {soon.length ? <ul className="flex flex-wrap gap-2">{soon.slice(0,8).map(item => <li key={item.id} className="rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-sm">{item.name} · {item.expiresOn}</li>)}</ul> : <p className="text-sm">No items with a date in the next three days. Add dates in Pantry to make this useful.</p>}
      <Link className="inline-flex min-h-11 items-center underline" href="/pantry/">Review pantry & dates</Link>
    </Card>
    <div className="grid sm:grid-cols-2 gap-4 mb-6">
      <label className="text-sm space-y-2">First day of this batch<Input aria-label="First day of this batch" type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
      <label className="text-sm space-y-2">People per meal<Select aria-label="People per meal" value={people} onChange={e => setPeople(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</Select></label>
    </div>
    <p className="text-sm text-[var(--text-muted)] mb-5">Pick a session for the selected date. Each adds lunch and dinner for three days ({6 * people} portions total). Existing meal slots stay in place. Schedule the other session with a later start date; the seventh day is for leftovers, a freezer meal, or trying something new.</p>
    <div className="grid xl:grid-cols-2 gap-5">{prepSessions.map(session => <Card key={session.id} className="space-y-4">
      <h2 className="text-xl font-semibold">{session.title}</h2><p className="text-sm text-[var(--text-muted)]">{session.shared}</p>
      <div className="grid grid-cols-2 gap-3">{session.recipes.map((id,i) => {const recipe=prepRecipes.find(r=>r.id===id)!;return <button key={id} className="text-left space-y-2" onClick={()=>setOpen(prepBatch(recipe,people))}><FoodVisual name={recipe.name}/><span className="text-xs uppercase text-[var(--text-muted)]">{i===0?'Lunch':'Dinner'} · days 1–3</span><span className="block font-medium text-sm">{recipe.name}</span></button>;})}</div>
      <details><summary className="cursor-pointer min-h-11 flex items-center font-medium text-sm">View prep order & small shopping list ＋</summary><ol className="list-decimal pl-5 space-y-2 text-sm">{session.order.map(step=><li key={step}>{step}</li>)}</ol>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">{(['fresh','staples'] as const).map(kind=><div key={kind}><h3 className="font-medium text-sm">{kind==='fresh'?'Fresh · buy for this batch':'Cupboard · check before restocking'}</h3><p className="text-sm text-[var(--text-muted)] mt-1">{Array.from(new Set(session.recipes.flatMap(id=>prepNotes[id][kind]))).join(', ')}</p></div>)}</div>
      </details>
      <Button disabled={busy || !start} onClick={()=>act(async()=>{const count=await planPrep(session.recipes.map(id=>prepRecipes.find(r=>r.id===id)!),start,people);return count ? `${count} meals added. Open Meal Plan to review, then shop these dates.` : 'These lunch and dinner slots already have meals. Choose another start date.';})}>Plan three days</Button>
    </Card>)}</div>
    <Card className="my-6 flex flex-wrap items-center gap-4"><Button variant="secondary" disabled={busy || !start} onClick={()=>act(async()=>{const count=await buildWeekList(prepDates(start));return count ? `${count} missing ingredients added for the selected three days.` : 'No missing ingredients to add. Check that these dates have planned meals.';})}>Shop selected three days</Button><Link href="/meal-plan/" className="min-h-11 inline-flex items-center underline">Open meal plan</Link><Link href="/shopping/" className="min-h-11 inline-flex items-center underline">Open shopping</Link></Card>
    <details className="rounded-xl border border-[var(--border)] p-5 mb-6"><summary className="cursor-pointer font-semibold min-h-11">Cool, store & reheat your batch</summary><p className="text-sm leading-relaxed mt-3">Portion cooked food into shallow containers and refrigerate promptly, within two hours (one hour above 90°F / 32°C). Keep the fridge at 40°F / 4°C or below. Most cooked leftovers keep 3–4 days; freeze portions you will not use in time. Reheat leftovers to 165°F / 74°C. Label containers with the preparation date.</p><p className="text-sm mt-3">Rice needs extra care: cool quickly, ideally within one hour. For this plan, cook rice fresh or freeze later portions promptly; the UK Food Standards Agency recommends using refrigerated rice within 24 hours. Reheat only the portion you will eat.</p><p className="text-xs mt-3">Sources: <a className="underline" href="https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety" target="_blank" rel="noreferrer">USDA leftovers guidance</a> · <a className="underline" href="https://www.food.gov.uk/print/pdf/node/4286" target="_blank" rel="noreferrer">FSA rice guidance</a></p></details>
    <h2 className="text-xl font-semibold mb-3">Breakfast & a branch-out bowl</h2><div className="grid sm:grid-cols-2 gap-4">{prepRecipes.slice(4).map(recipe=><button className="text-left rounded-xl border border-[var(--border)] p-4 space-y-3" key={recipe.id} onClick={()=>setOpen(prepBatch(recipe,people))}><FoodVisual name={recipe.name}/><h3 className="font-medium">{recipe.name}</h3><p className="text-sm text-[var(--text-muted)]">{recipe.description}</p></button>)}</div>
    <p className="mt-6 text-xs text-[var(--text-muted)]">Original Pantry Pal kitchen drafts, inspired by these cuisines. Timing is approximate; adjust seasoning and follow package instructions. <Link href="/food-guide/" className="underline">Explore the food & nutrition guide.</Link></p>
    {open && <RecipeDetail key={open.id} recipe={open} onClose={()=>setOpen(null)} onCook={r=>{setOpen(null);setCooking(r);}}/>}{cooking&&<CookMode recipe={cooking} onClose={()=>setCooking(null)}/>}
  </div>;
}
