"use client";

import { useMemo } from "react";
import { ChefHat, Leaf, TrendingDown, Wallet } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Badge, Card } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { format, parseISO, subDays } from "date-fns";

export default function AnalyticsPage() {
  const usage = useAppStore((s) => s.usage);
  const pantry = useAppStore((s) => s.pantry);
  const mealPlan = useAppStore((s) => s.mealPlan);

  const cooked = usage.filter((u) => u.reason === "used").length;
  const wasted = usage.filter((u) => u.reason === "wasted").length;
  const wasteRate = cooked + wasted === 0 ? 0 : wasted / (cooked + wasted);
  const savedEstimate = cooked * 7.5;

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

  const last14Days = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = format(subDays(new Date(), 13 - i), "yyyy-MM-dd");
      const count = mealPlan.filter((m) => m.date === d).length;
      return { date: d, count };
    });
  }, [mealPlan]);

  const maxCount = Math.max(1, ...last14Days.map((d) => d.count));

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Trends in how you cook, shop, and store."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat
          icon={<Wallet className="size-4" />}
          tone="info"
          label="Estimated saved"
          value={`$${savedEstimate.toFixed(0)}`}
          hint="vs. eating out"
        />
        <Stat
          icon={<ChefHat className="size-4" />}
          tone="fresh"
          label="Meals cooked"
          value={cooked}
          hint="from tracked usage"
        />
        <Stat
          icon={<TrendingDown className="size-4" />}
          tone={wasteRate > 0.1 ? "soon" : "fresh"}
          label="Waste rate"
          value={`${(wasteRate * 100).toFixed(0)}%`}
          hint={`${wasted} item(s) wasted`}
        />
        <Stat
          icon={<Leaf className="size-4" />}
          tone="fresh"
          label="Items tracked"
          value={pantry.length}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-semibold mb-4">Pantry by category</h2>
          <div className="space-y-2">
            {byCategory.map(([cat, n]) => {
              const pct = (n / pantry.length) * 100;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{cat}</span>
                    <span className="text-[var(--text-muted)]">{n}</span>
                  </div>
                  <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {byCategory.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">
                Nothing tracked yet.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold mb-4">Items by storage zone</h2>
          <div className="grid grid-cols-3 gap-3">
            {byZone.map(([z, n]) => (
              <div
                key={z}
                className="text-center border border-[var(--border)] rounded-xl p-4"
              >
                <div className="text-3xl font-semibold">{n}</div>
                <div className="text-xs text-[var(--text-muted)] capitalize mt-1">
                  {z}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex justify-between mb-4">
            <h2 className="font-semibold">Cooking activity (14d)</h2>
            <Badge tone="info">
              {last14Days.reduce((s, d) => s + d.count, 0)} planned meals
            </Badge>
          </div>
          <div className="flex items-end gap-1 h-32">
            {last14Days.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex-1 w-full flex items-end">
                  <div
                    className="w-full bg-[var(--accent)] rounded-t-md min-h-[2px]"
                    style={{ height: `${(d.count / maxCount) * 100}%` }}
                    title={`${d.count} meals on ${d.date}`}
                  />
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                  {format(parseISO(d.date), "d")}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="font-semibold mb-4">Recent activity</h2>
          {usage.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No usage events yet. Use or waste an item from the pantry to start
              tracking.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {usage
                .slice()
                .reverse()
                .slice(0, 8)
                .map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between border-b border-[var(--border)] last:border-0 pb-2 last:pb-0"
                  >
                    <div>
                      <span className="font-medium">{u.itemName}</span>
                      <span className="text-[var(--text-muted)]">
                        {" "}
                        — {u.quantity}
                        {u.unit}
                      </span>
                    </div>
                    <Badge tone={u.reason === "used" ? "fresh" : "expired"}>
                      {u.reason}
                    </Badge>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone: "fresh" | "soon" | "info";
}) {
  const toneClass: Record<string, string> = {
    fresh: "bg-[var(--accent-soft)] text-[var(--accent-hover)]",
    soon: "bg-[var(--warn-soft)] text-[var(--warn)]",
    info: "bg-[var(--info-soft)] text-[var(--info)]",
  };
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span
          className={`size-7 rounded-md grid place-items-center ${toneClass[tone]}`}
        >
          {icon}
        </span>
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint && (
        <div className="text-xs text-[var(--text-muted)] mt-0.5">{hint}</div>
      )}
    </Card>
  );
}
