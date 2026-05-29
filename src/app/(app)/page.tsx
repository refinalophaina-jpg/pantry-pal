"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChefHat,
  ExternalLink,
  Flame,
  Leaf,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { useAppStore, matchRecipeAgainstPantry } from "@/lib/store";
import { Badge, Button, Card } from "@/components/ui";
import { ExpiryBanner } from "@/components/expiry-banner";
import { daysUntil, dealSearchUrl, expiryStatus, fmtDate, todayISO } from "@/lib/utils";
import { estimateRecipeNutrition } from "@/lib/nutrition";
import { useMounted } from "@/lib/use-mounted";

export default function DashboardPage() {
  const pantry = useAppStore((s) => s.pantry);
  const recipes = useAppStore((s) => s.recipes);
  const savedRecipes = useAppStore((s) => s.savedRecipes);
  const equipment = useAppStore((s) => s.equipment);
  const usage = useAppStore((s) => s.usage);
  const deals = useAppStore((s) => s.deals);
  const mealPlan = useAppStore((s) => s.mealPlan);

  // todayISO() reads the wall clock, which differs between the static-export
  // build and the client. Defer it to after mount so the first client render
  // matches the server HTML (empty plan), then fills in once mounted.
  const mounted = useMounted();
  const today = mounted ? todayISO() : "";
  const todayPlan = useMemo(
    () => (today ? mealPlan.filter((m) => m.date === today) : []),
    [mealPlan, today],
  );

  const [todayCalories, setTodayCalories] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = [...savedRecipes, ...recipes];
      let total = 0;
      for (const entry of todayPlan) {
        const recipe = all.find((r) => r.id === entry.recipeId);
        if (!recipe) continue;
        if (recipe.calories) {
          total += recipe.calories;
          continue;
        }
        const n = await estimateRecipeNutrition(recipe);
        total += n.perServing.calories;
      }
      if (!cancelled) setTodayCalories(total > 0 ? Math.round(total) : 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [todayPlan, recipes, savedRecipes]);

  const expiringSoon = useMemo(
    () =>
      pantry
        .filter((p) => {
          const d = daysUntil(p.expiresOn);
          return d !== null && d <= 3;
        })
        .sort(
          (a, b) =>
            (daysUntil(a.expiresOn) ?? 0) - (daysUntil(b.expiresOn) ?? 0),
        ),
    [pantry],
  );

  const cookable = useMemo(
    () =>
      recipes
        .map((r) => ({
          recipe: r,
          match: matchRecipeAgainstPantry(r, pantry, equipment),
        }))
        .sort((a, b) => b.match.score - a.match.score)
        .slice(0, 4),
    [recipes, pantry, equipment],
  );

  const cooked = usage.filter((u) => u.reason === "used").length;
  const wasted = usage.filter((u) => u.reason === "wasted").length;
  const savedEstimate = cooked * 7.5 + deals.length * 1.2;

  return (
    <div>
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-[var(--border)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/illustrations/hero.svg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <div
          className="relative px-6 py-10 sm:py-12"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--surface) 0%, color-mix(in srgb, var(--surface) 70%, transparent) 45%, transparent 100%)",
          }}
        >
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Good evening 👋
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-sm">
            Here&apos;s what&apos;s happening in your kitchen today.
          </p>
        </div>
      </div>

      <ExpiryBanner />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          icon={<Leaf className="size-4" />}
          tone="fresh"
          label="In pantry"
          value={pantry.length}
          hint="items tracked"
        />
        <StatCard
          icon={<AlertTriangle className="size-4" />}
          tone={expiringSoon.length > 0 ? "soon" : "fresh"}
          label="Expiring ≤ 3d"
          value={expiringSoon.length}
          hint={expiringSoon.length > 0 ? "use these soon" : "all good"}
        />
        <StatCard
          icon={<Flame className="size-4" />}
          tone="info"
          label="Today's plan"
          value={
            todayCalories === null
              ? "…"
              : todayCalories > 0
                ? `${todayCalories} kcal`
                : "—"
          }
          hint={`${todayPlan.length} meal${todayPlan.length === 1 ? "" : "s"}`}
        />
        <StatCard
          icon={<Wallet className="size-4" />}
          tone="info"
          label="Est. saved"
          value={`$${savedEstimate.toFixed(0)}`}
          hint="vs. takeout"
        />
        <StatCard
          icon={<TrendingDown className="size-4" />}
          tone={wasted > 0 ? "soon" : "fresh"}
          label="Waste events"
          value={wasted}
          hint="this month"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <ChefHat className="size-4 text-[var(--accent)]" />
                Cook with what you have
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Sorted by how many ingredients you already own.
              </p>
            </div>
            <Link href="/recipes">
              <Button variant="ghost" size="sm">
                Browse all →
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cookable.map(({ recipe, match }) => (
              <Link
                key={recipe.id}
                href={`/recipes#${recipe.id}`}
                className="rounded-xl border border-[var(--border)] p-4 hover:border-[var(--accent)] transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium group-hover:text-[var(--accent-hover)]">
                    {recipe.name}
                  </div>
                  {match.canCook ? (
                    <Badge tone="fresh">Ready</Badge>
                  ) : (
                    <Badge tone="info">
                      {match.have}/{match.total}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                  {recipe.description}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span>{recipe.minutes} min</span>
                  <span>·</span>
                  <span className="capitalize">{recipe.difficulty}</span>
                  <span>·</span>
                  <span>{recipe.cuisine}</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <AlertTriangle className="size-4 text-[var(--warn)]" />
            Use it or lose it
          </h2>
          {expiringSoon.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Nothing expiring in the next 3 days. Nice work.
            </p>
          ) : (
            <ul className="space-y-2">
              {expiringSoon.slice(0, 6).map((item) => {
                const s = expiryStatus(item.expiresOn);
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {item.quantity} {item.unit} · {item.zone}
                      </div>
                    </div>
                    <Badge tone={s.tone === "none" ? "default" : s.tone}>
                      {s.label}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/pantry">
            <Button variant="secondary" size="sm" className="w-full mt-4">
              Open pantry
            </Button>
          </Link>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Sparkles className="size-4 text-[var(--accent)]" />
            Local deals worth grabbing
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {deals.slice(0, 6).map((d) => (
              <a
                key={d.id}
                href={dealSearchUrl(d.item, d.store)}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-lg border border-[var(--border)] px-3 py-2 flex items-center justify-between hover:border-[var(--accent)] transition-colors"
                title={`Compare prices for ${d.item}`}
              >
                <div className="text-sm min-w-0">
                  <div className="font-medium flex items-center gap-1">
                    {d.item}
                    <ExternalLink className="size-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {d.store} · until {fmtDate(d.validUntil)}
                  </div>
                </div>
                <div className="text-sm font-semibold whitespace-nowrap">
                  ${d.price.toFixed(2)}
                  <span className="text-xs text-[var(--text-muted)] font-normal">
                    /{d.unit}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <ShoppingCart className="size-4 text-[var(--accent)]" />
            Quick actions
          </h2>
          <div className="space-y-2">
            <Link href="/pantry">
              <Button variant="secondary" className="w-full">
                Add to pantry
              </Button>
            </Link>
            <Link href="/shopping">
              <Button variant="secondary" className="w-full">
                Build shopping list
              </Button>
            </Link>
            <Link href="/meal-plan">
              <Button variant="secondary" className="w-full">
                Plan this week
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
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
