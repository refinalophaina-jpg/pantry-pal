"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { SectionTitle } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { useMounted } from "@/lib/use-mounted";
import { format, parseISO, subDays } from "date-fns";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const usage = useAppStore((s) => s.usage);
  const pantry = useAppStore((s) => s.pantry);
  const mealPlan = useAppStore((s) => s.mealPlan);

  const cooked = usage.filter((u) => u.reason === "used").length;
  const wasted = usage.filter((u) => u.reason === "wasted").length;
  const wasteRate = cooked + wasted === 0 ? 0 : wasted / (cooked + wasted);

  const byCategory = useMemo(() => {
    const c: Record<string, number> = {};
    pantry.forEach((p) => {
      c[p.category] = (c[p.category] ?? 0) + 1;
    });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [pantry]);

  const byZone = useMemo(() => {
    const z: Record<string, number> = { pantry: 0, fridge: 0, freezer: 0 };
    pantry.forEach((p) => {
      z[p.zone] = (z[p.zone] ?? 0) + 1;
    });
    return Object.entries(z);
  }, [pantry]);

  // subDays(new Date(), …) reads the wall clock; defer to after mount so the
  // static-export HTML and the first client render agree (empty chart).
  const mounted = useMounted();
  const last14Days = useMemo(() => {
    if (!mounted) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const d = format(subDays(new Date(), 13 - i), "yyyy-MM-dd");
      const count = mealPlan.filter((m) => m.date === d).length;
      return { date: d, count };
    });
  }, [mounted, mealPlan]);

  const maxCount = Math.max(1, ...last14Days.map((d) => d.count));
  const plannedMeals = last14Days.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="How you cook, shop and store, from what the app has tracked."
      />

      <dl className="mb-10 grid grid-cols-3 gap-6 border-y border-[var(--border)] py-4 sm:max-w-xl">
        <Figure label="Items used" value={cooked} />
        <Figure label="Items wasted" value={wasted} tone={wasted > 0 ? "warn" : undefined} />
        <Figure label="Waste rate" value={`${(wasteRate * 100).toFixed(0)}%`} tone={wasteRate > 0.1 ? "warn" : undefined} />
      </dl>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        <section>
          <SectionTitle className="mb-3">Pantry by category</SectionTitle>
          <div className="space-y-3">
            {byCategory.map(([cat, n]) => {
              const pct = (n / pantry.length) * 100;
              return (
                <div key={cat}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{cat}</span>
                    <span className="tabular-nums text-[var(--text-muted)]">{n}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                    <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {byCategory.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">Nothing tracked yet.</p>
            )}
          </div>
        </section>

        <section>
          <SectionTitle className="mb-3">Where things are stored</SectionTitle>
          <dl className="grid grid-cols-3 gap-6 border-y border-[var(--border)] py-4">
            {byZone.map(([z, n]) => (
              <Figure key={z} label={z} value={n} capitalize />
            ))}
          </dl>
        </section>

        <section className="lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <SectionTitle>Planned meals, last 14 days</SectionTitle>
            <span className="text-sm tabular-nums text-[var(--text-muted)]">{plannedMeals} planned</span>
          </div>
          <div className="flex h-32 items-end gap-1">
            {!mounted
              ? Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="flex h-full flex-1 items-end">
                    <div className="skeleton h-3 w-full rounded-t-md" />
                  </div>
                ))
              : last14Days.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="min-h-[2px] w-full rounded-t-md bg-[var(--accent)]"
                    style={{ height: `${(d.count / maxCount) * 100}%` }}
                    title={`${d.count} meals on ${d.date}`}
                  />
                </div>
                <div className="text-xs tabular-nums text-[var(--text-muted)]">
                  {format(parseISO(d.date), "d")}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-2">
          <SectionTitle className="mb-3">Recent activity</SectionTitle>
          {usage.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Nothing yet. Use or waste an item from the pantry to start tracking.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
              {usage
                .slice()
                .reverse()
                .slice(0, 8)
                .map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div>
                      <span className="font-medium">{u.itemName}</span>
                      <span className="text-[var(--text-muted)]"> · {u.quantity}{u.unit}</span>
                    </div>
                    <span className={cn("shrink-0 capitalize", u.reason === "used" ? "text-[var(--fresh)]" : "text-[var(--danger)]")}>
                      {u.reason}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
  capitalize,
}: {
  label: string;
  value: string | number;
  tone?: "warn";
  capitalize?: boolean;
}) {
  return (
    <div>
      <dt className={cn("text-sm text-[var(--text-muted)]", capitalize && "capitalize")}>{label}</dt>
      <dd className={cn("mt-0.5 text-2xl font-medium tabular-nums", tone === "warn" && "text-[var(--warn)]")}>{value}</dd>
    </div>
  );
}
