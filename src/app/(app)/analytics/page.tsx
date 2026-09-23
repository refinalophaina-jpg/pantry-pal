"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { SectionTitle } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { useMounted } from "@/lib/use-mounted";
import { cuisineMix, insights, pantryHealth, topPlanned, topWasted, weeklyUsage } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const usage = useAppStore((s) => s.usage);
  const pantry = useAppStore((s) => s.pantry);
  const mealPlan = useAppStore((s) => s.mealPlan);
  const recipes = useAppStore((s) => s.recipes);
  const savedRecipes = useAppStore((s) => s.savedRecipes);
  // Everything here reads the wall clock; defer until mounted so the static
  // export and the first client render agree.
  const mounted = useMounted();
  const all = useMemo(() => [...savedRecipes, ...recipes], [savedRecipes, recipes]);
  const weeks = useMemo(() => (mounted ? weeklyUsage(usage, 8) : []), [mounted, usage]);
  const wasted = useMemo(() => (mounted ? topWasted(usage) : []), [mounted, usage]);
  const planned = useMemo(() => (mounted ? topPlanned(mealPlan, all) : []), [mounted, mealPlan, all]);
  const mix = useMemo(() => (mounted ? cuisineMix(mealPlan, all) : []), [mounted, mealPlan, all]);
  const health = useMemo(() => (mounted ? pantryHealth(pantry) : null), [mounted, pantry]);
  const notes = useMemo(() => (mounted ? insights({ usage, pantry, mealPlan, recipes: all }) : []), [mounted, usage, pantry, mealPlan, all]);
  const maxWeek = Math.max(1, ...weeks.map((week) => week.used + week.wasted));
  const used = weeks.reduce((total, week) => total + week.used, 0);
  const wastedTotal = weeks.reduce((total, week) => total + week.wasted, 0);
  const plannedTotal = mix.reduce((total, item) => total + item.count, 0);
  const quiet = usage.length === 0 && plannedTotal === 0;

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Eight weeks of what you used, wasted, planned and stored, with what to do about it." />

      {mounted && quiet ? (
        <>
          <section aria-labelledby="health-title-quiet" className="mb-10">
            <SectionTitle className="mb-3"><span id="health-title-quiet">Pantry health</span></SectionTitle>
            {health && <HealthFigures health={health} />}
          </section>
          <div className="rounded-xl border border-dashed border-[var(--border)] px-5 py-8 text-center">
            <h2 className="font-medium">Nothing tracked yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-[var(--text-muted)]">Use and waste show up here week by week, with the dishes and cuisines you plan most. Two things start it.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm">
              <Link href="/pantry/" className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 font-medium hover:bg-[var(--bg)]">Use 1 or Mark wasted in Pantry</Link>
              <Link href="/meal-plan/" className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 font-medium hover:bg-[var(--bg)]">Plan a week</Link>
            </div>
          </div>
        </>
      ) : (
      <>
      {mounted && (
        <ul className="mb-8 space-y-2 text-sm">
          {notes.map((note) => <li key={note} className="flex gap-3"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--accent)]" /><span>{note}</span></li>)}
        </ul>
      )}

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        <section aria-labelledby="usage-title" className="lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <SectionTitle><span id="usage-title">Used and wasted, by week</span></SectionTitle>
            <span className="text-sm tabular-nums text-[var(--text-muted)]">{used} used · {wastedTotal} wasted</span>
          </div>
          {!mounted ? (
            <div className="flex h-36 items-end gap-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-4 flex-1 rounded-t-md" />)}</div>
          ) : used + wastedTotal === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nothing tracked yet. Use 1 or Mark wasted in <Link href="/pantry/" className="underline underline-offset-4">Pantry</Link> and this chart fills in week by week.</p>
          ) : (
            <div className="flex h-36 items-end gap-2" role="img" aria-label={`Weekly used and wasted items over eight weeks: ${weeks.map((week) => `${week.label}: ${week.used} used, ${week.wasted} wasted`).join("; ")}`}>
              {weeks.map((week) => (
                <div key={week.start} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 flex-col-reverse justify-start gap-px">
                    <div className="w-full rounded-t-sm bg-[var(--fresh)]" style={{ height: `${(week.used / maxWeek) * 100}%` }} title={`${week.used} used`} />
                    <div className="w-full rounded-t-sm bg-[var(--danger)]" style={{ height: `${(week.wasted / maxWeek) * 100}%` }} title={`${week.wasted} wasted`} />
                  </div>
                  <div className="text-xs tabular-nums text-[var(--text-muted)]">{week.label}</div>
                </div>
              ))}
            </div>
          )}
          {mounted && used + wastedTotal > 0 && <p className="mt-2 text-xs text-[var(--text-muted)]"><span className="inline-block size-2 rounded-sm bg-[var(--fresh)]" /> used · <span className="inline-block size-2 rounded-sm bg-[var(--danger)]" /> wasted</p>}
        </section>

        <section aria-labelledby="wasted-title">
          <SectionTitle className="mb-3"><span id="wasted-title">Most wasted</span></SectionTitle>
          <Ranked items={wasted} empty="Nothing wasted in eight weeks." unit="times" tone="danger" />
        </section>

        <section aria-labelledby="planned-title">
          <SectionTitle className="mb-3"><span id="planned-title">Most planned</span></SectionTitle>
          <Ranked items={planned} empty="No meals planned in the last eight weeks yet." unit="meals" />
        </section>

        <section aria-labelledby="mix-title">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <SectionTitle><span id="mix-title">Cuisine mix</span></SectionTitle>
            <span className="text-sm tabular-nums text-[var(--text-muted)]">{plannedTotal} meals</span>
          </div>
          {mix.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Plan a week and this shows how varied it was.</p>
          ) : (
            <div className="space-y-3">
              {mix.slice(0, 8).map((item) => (
                <div key={item.name}>
                  <div className="mb-1 flex justify-between text-sm"><span>{item.name}</span><span className="tabular-nums text-[var(--text-muted)]">{Math.round((item.count / plannedTotal) * 100)}%</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full bg-[var(--accent)]" style={{ width: `${(item.count / plannedTotal) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="health-title">
          <SectionTitle className="mb-3"><span id="health-title">Pantry health</span></SectionTitle>
          {health && <HealthFigures health={health} />}
        </section>

        <section className="lg:col-span-2">
          <SectionTitle className="mb-3">Recent activity</SectionTitle>
          {usage.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Nothing yet. Use or waste an item from the pantry to start tracking.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
              {usage.slice(0, 8).map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div><span className="font-medium">{u.itemName}</span><span className="text-[var(--text-muted)]"> · {u.quantity}{u.unit}</span></div>
                  <span className={cn("shrink-0 capitalize", u.reason === "used" ? "text-[var(--fresh)]" : "text-[var(--danger)]")}>{u.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      </>
      )}
    </div>
  );
}

function HealthFigures({ health }: { health: NonNullable<ReturnType<typeof pantryHealth>> }) {
  return (
    <>
      <dl className="grid grid-cols-2 gap-6 border-y border-[var(--border)] py-4 sm:grid-cols-4">
        <Figure label="Past their date" value={health.expired} tone={health.expired ? "danger" : undefined} />
        <Figure label="Within 3 days" value={health.soon} tone={health.soon ? "warn" : undefined} />
        <Figure label="No date" value={health.noDate} />
        <Figure label="Untouched 45+ days" value={health.stale} tone={health.stale ? "warn" : undefined} />
      </dl>
      <dl className="grid grid-cols-3 gap-6 py-4">
        {health.byZone.map((zone) => <Figure key={zone.name} label={zone.name} value={zone.count} capitalize />)}
      </dl>
    </>
  );
}

function Ranked({ items, empty, unit, tone }: { items: Array<{ name: string; count: number }>; empty: string; unit: string; tone?: "danger" }) {
  if (!items.length) return <p className="text-sm text-[var(--text-muted)]">{empty}</p>;
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.name}>
          <div className="mb-1 flex justify-between text-sm"><span>{item.name}</span><span className="tabular-nums text-[var(--text-muted)]">{item.count} {unit}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]"><div className={cn("h-full", tone === "danger" ? "bg-[var(--danger)]" : "bg-[var(--accent)]")} style={{ width: `${(item.count / max) * 100}%` }} /></div>
        </li>
      ))}
    </ol>
  );
}

function Figure({ label, value, tone, capitalize }: { label: string; value: string | number; tone?: "warn" | "danger"; capitalize?: boolean }) {
  return (
    <div>
      <dt className={cn("text-sm text-[var(--text-muted)]", capitalize && "capitalize")}>{label}</dt>
      <dd className={cn("mt-0.5 text-2xl font-medium tabular-nums", tone === "warn" && "text-[var(--warn)]", tone === "danger" && "text-[var(--danger)]")}>{value}</dd>
    </div>
  );
}
