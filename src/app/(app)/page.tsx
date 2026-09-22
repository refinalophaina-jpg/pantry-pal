"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { useAppStore, matchRecipeAgainstPantry } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { ExpiryBanner } from "@/components/expiry-banner";
import { PageHeader } from "@/components/page-header";
import { SectionTitle } from "@/components/ui";
import { daysUntil, expiryStatus, todayISO, cn } from "@/lib/utils";
import { estimateRecipeNutrition } from "@/lib/nutrition";
import { useMounted } from "@/lib/use-mounted";

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];

export default function DashboardPage() {
  const pantry = useAppStore((s) => s.pantry);
  const recipes = useAppStore((s) => s.recipes);
  const savedRecipes = useAppStore((s) => s.savedRecipes);
  const equipment = useAppStore((s) => s.equipment);
  const mealPlan = useAppStore((s) => s.mealPlan);
  const shopping = useAppStore((s) => s.shopping);
  const { household } = useAuth();

  // The wall clock differs between the static-export build and the client.
  // Defer date-dependent values to after mount so the first client render
  // matches the server HTML, then fill in.
  const mounted = useMounted();
  const today = mounted ? todayISO() : "";
  const title = mounted ? format(new Date(), "EEEE, d MMMM") : "Today";

  const allRecipes = useMemo(
    () => Array.from(new Map([...recipes, ...savedRecipes].map((r) => [r.id, r])).values()),
    [recipes, savedRecipes],
  );

  const todayPlan = useMemo(
    () =>
      (today ? mealPlan.filter((m) => m.date === today) : [])
        .slice()
        .sort((a, b) => MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal)),
    [mealPlan, today],
  );

  const [todayCalories, setTodayCalories] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let total = 0;
      for (const entry of todayPlan) {
        const recipe = allRecipes.find((r) => r.id === entry.recipeId);
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
  }, [todayPlan, allRecipes]);

  const expiringSoon = useMemo(
    () =>
      pantry
        .filter((p) => {
          const d = daysUntil(p.expiresOn);
          return d !== null && d <= 3;
        })
        .sort((a, b) => (daysUntil(a.expiresOn) ?? 0) - (daysUntil(b.expiresOn) ?? 0)),
    [pantry],
  );

  const cookable = useMemo(
    () =>
      recipes
        .map((r) => ({ recipe: r, match: matchRecipeAgainstPantry(r, pantry, equipment) }))
        .sort((a, b) => b.match.score - a.match.score)
        .slice(0, 5),
    [recipes, pantry, equipment],
  );

  const openShopping = shopping.filter((s) => !s.done).length;

  return (
    <div>
      <PageHeader title={title} subtitle={household?.name} />

      <ExpiryBanner />

      <ul className="mb-8 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-[var(--text-muted)] sm:flex sm:flex-wrap sm:gap-y-2">
        <Fact href="/pantry" count={pantry.length} label="in the pantry" />
        <Fact
          href="/pantry"
          count={expiringSoon.length}
          label="expiring soon"
          tone={expiringSoon.length > 0 ? "warn" : undefined}
        />
        <Fact
          href="/meal-plan"
          count={todayPlan.length}
          label={todayPlan.length === 1 ? "meal planned today" : "meals planned today"}
        />
        <Fact href="/shopping" count={openShopping} label="on the shopping list" />
      </ul>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
        <section aria-labelledby="cook-title">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <SectionTitle>
              <span id="cook-title">Cook with what you have</span>
            </SectionTitle>
            <SectionLink href="/recipes">All recipes</SectionLink>
          </div>
          {cookable.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Save a recipe from Explore and it will show up here, ranked by what you already own.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {cookable.map(({ recipe, match }) => (
                <li key={recipe.id}>
                  <Link
                    href={`/recipes#${recipe.id}`}
                    className="group flex items-center justify-between gap-4 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium group-hover:text-[var(--accent-hover)]">
                        {recipe.name}
                      </span>
                      <span className="block text-sm text-[var(--text-muted)]">
                        {recipe.minutes} min · <span className="capitalize">{recipe.difficulty}</span> · {recipe.cuisine}
                      </span>
                    </span>
                    {match.canCook ? (
                      <span className="shrink-0 text-sm font-medium text-[var(--fresh)]">Ready</span>
                    ) : (
                      <span className="shrink-0 text-sm tabular-nums text-[var(--text-muted)]">
                        {match.have}/{match.total} ingredients
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-10">
          <section aria-labelledby="soon-title">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <SectionTitle>
                <span id="soon-title">Use soon</span>
              </SectionTitle>
              <SectionLink href="/pantry">Pantry</SectionLink>
            </div>
            {expiringSoon.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                Nothing expires in the next three days.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {expiringSoon.slice(0, 6).map((item) => {
                  const status = expiryStatus(item.expiresOn);
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-4 py-2.5">
                      <span className="min-w-0">
                        <span className="block font-medium">{item.name}</span>
                        <span className="block text-sm text-[var(--text-muted)]">
                          {item.quantity} {item.unit} · {item.zone}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-medium",
                          status.tone === "expired"
                            ? "text-[var(--danger)]"
                            : status.tone === "today" || status.tone === "soon"
                              ? "text-[var(--warn)]"
                              : "text-[var(--text-muted)]",
                        )}
                      >
                        {status.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="plan-title">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <SectionTitle>
                <span id="plan-title">Today&apos;s plan</span>
              </SectionTitle>
              <SectionLink href="/meal-plan">Meal plan</SectionLink>
            </div>
            {todayPlan.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                No meals planned for today.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                  {todayPlan.map((entry) => {
                    const recipe = allRecipes.find((r) => r.id === entry.recipeId);
                    return (
                      <li key={entry.id} className="flex items-center gap-4 py-2.5">
                        <span className="w-20 shrink-0 text-sm capitalize text-[var(--text-muted)]">
                          {entry.meal}
                        </span>
                        <span className="min-w-0 truncate font-medium">
                          {recipe?.name ?? "Recipe unavailable"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {todayCalories !== null && todayCalories > 0 && (
                  <p className="mt-2 text-sm text-[var(--text-muted)]">
                    About {todayCalories} kcal per person, estimated.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Fact({
  href,
  count,
  label,
  tone,
}: {
  href: string;
  count: number;
  label: string;
  tone?: "warn";
}) {
  return (
    <li>
      <Link href={href} className="inline-flex min-h-11 items-baseline gap-1.5 hover:text-[var(--text)]">
        <span
          className={cn(
            "text-xl font-medium tabular-nums",
            tone === "warn" ? "text-[var(--warn)]" : "text-[var(--text)]",
          )}
        >
          {count}
        </span>
        <span>{label}</span>
      </Link>
    </li>
  );
}

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  );
}
