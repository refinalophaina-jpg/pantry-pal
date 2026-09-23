import { differenceInCalendarDays, format, parseISO, startOfWeek, subDays } from "date-fns";
import type { MealPlanEntry, PantryItem, Recipe, UsageEvent } from "./types";

/** Pure household insights computed from tracked usage, plans and stock. */
export interface WeekBucket { start: string; label: string; used: number; wasted: number }

export function weeklyUsage(usage: UsageEvent[], weeks = 8, today = new Date()): WeekBucket[] {
  const first = startOfWeek(subDays(today, (weeks - 1) * 7), { weekStartsOn: 1 });
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, index) => {
    const start = new Date(first); start.setDate(first.getDate() + index * 7);
    return { start: format(start, "yyyy-MM-dd"), label: format(start, "d MMM"), used: 0, wasted: 0 };
  });
  for (const event of usage) {
    const at = event.at.slice(0, 10);
    const bucket = [...buckets].reverse().find(item => item.start <= at);
    if (!bucket || at < buckets[0].start) continue;
    if (event.reason === "wasted") bucket.wasted++; else bucket.used++;
  }
  return buckets;
}

export interface NameCount { name: string; count: number }

export function topWasted(usage: UsageEvent[], days = 56, today = new Date()): NameCount[] {
  const since = format(subDays(today, days), "yyyy-MM-dd");
  const counts = new Map<string, number>();
  for (const event of usage) if (event.reason === "wasted" && event.at.slice(0, 10) >= since) counts.set(event.itemName, (counts.get(event.itemName) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 6);
}

export function topPlanned(mealPlan: MealPlanEntry[], recipes: Recipe[], days = 56, today = new Date()): NameCount[] {
  const since = format(subDays(today, days), "yyyy-MM-dd");
  const until = format(today, "yyyy-MM-dd");
  const counts = new Map<string, number>();
  for (const entry of mealPlan) {
    if (entry.date < since || entry.date > until) continue;
    const name = recipes.find(recipe => recipe.id === entry.recipeId)?.name ?? "Recipe no longer saved";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 6);
}

export function cuisineMix(mealPlan: MealPlanEntry[], recipes: Recipe[], days = 56, today = new Date()): NameCount[] {
  const since = format(subDays(today, days), "yyyy-MM-dd");
  const until = format(today, "yyyy-MM-dd");
  const counts = new Map<string, number>();
  for (const entry of mealPlan) {
    if (entry.date < since || entry.date > until) continue;
    const recipe = recipes.find(item => item.id === entry.recipeId);
    if (!recipe) continue;
    const cuisine = recipe.cuisine || "International";
    counts.set(cuisine, (counts.get(cuisine) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export interface PantryHealth { total: number; expired: number; soon: number; noDate: number; stale: number; byZone: NameCount[] }

export function pantryHealth(pantry: PantryItem[], today = new Date()): PantryHealth {
  const todayIso = format(today, "yyyy-MM-dd");
  const health: PantryHealth = { total: pantry.length, expired: 0, soon: 0, noDate: 0, stale: 0, byZone: [] };
  const zones = new Map<string, number>();
  for (const item of pantry) {
    zones.set(item.zone, (zones.get(item.zone) ?? 0) + 1);
    if (!item.expiresOn) {
      health.noDate++;
      if (item.addedOn && differenceInCalendarDays(today, parseISO(item.addedOn.slice(0, 10))) > 45 && item.zone !== "freezer") health.stale++;
      continue;
    }
    if (item.expiresOn < todayIso) health.expired++;
    else if (differenceInCalendarDays(parseISO(item.expiresOn), today) <= 3) health.soon++;
  }
  health.byZone = ["pantry", "fridge", "freezer"].map(zone => ({ name: zone, count: zones.get(zone) ?? 0 }));
  return health;
}

/** Plain-language observations. Each one names a number and an action. */
export function insights(input: { usage: UsageEvent[]; pantry: PantryItem[]; mealPlan: MealPlanEntry[]; recipes: Recipe[]; today?: Date }): string[] {
  const today = input.today ?? new Date();
  const notes: string[] = [];
  const weeks = weeklyUsage(input.usage, 8, today);
  const recent = weeks.slice(4); const earlier = weeks.slice(0, 4);
  const sum = (list: WeekBucket[], key: "used" | "wasted") => list.reduce((total, bucket) => total + bucket[key], 0);
  const recentWaste = sum(recent, "wasted"); const recentUsed = sum(recent, "used");
  const earlierWaste = sum(earlier, "wasted"); const earlierUsed = sum(earlier, "used");
  if (recentUsed + recentWaste === 0 && earlierUsed + earlierWaste === 0) notes.push("No usage tracked yet. Tap Use 1 or Mark wasted in Pantry to start.");
  else {
    const rate = recentWaste / Math.max(1, recentUsed + recentWaste);
    const previous = earlierWaste / Math.max(1, earlierUsed + earlierWaste);
    if (recentWaste === 0) notes.push("Nothing wasted in the last four weeks.");
    else if (earlierUsed + earlierWaste > 0 && rate < previous - 0.05) notes.push(`Waste fell from ${Math.round(previous * 100)}% to ${Math.round(rate * 100)}% of tracked items over the last four weeks.`);
    else if (earlierUsed + earlierWaste > 0 && rate > previous + 0.05) notes.push(`Waste rose from ${Math.round(previous * 100)}% to ${Math.round(rate * 100)}% of tracked items. Smaller fresh shops and a three-day prep help most.`);
    else notes.push(`${Math.round(rate * 100)}% of tracked items were wasted in the last four weeks.`);
  }
  const wasted = topWasted(input.usage, 56, today);
  if (wasted.length && wasted[0].count >= 2) notes.push(`${wasted[0].name} was wasted ${wasted[0].count} times in eight weeks. Buy less of it, or plan a recipe that uses it the day you shop.`);
  const health = pantryHealth(input.pantry, today);
  if (health.expired) notes.push(`${health.expired} item${health.expired === 1 ? " is" : "s are"} past its date. Check and clear them so the planner works from real stock.`);
  if (health.noDate >= 5 && health.noDate / Math.max(1, health.total) > 0.5) notes.push(`${health.noDate} of ${health.total} pantry items have no date. Dates on fresh food drive the Use-soon list and meal suggestions.`);
  const mix = cuisineMix(input.mealPlan, input.recipes, 56, today);
  const planned = mix.reduce((total, item) => total + item.count, 0);
  if (planned >= 6 && mix[0].count / planned >= 0.6) notes.push(`${Math.round((mix[0].count / planned) * 100)}% of planned meals were ${mix[0].name}. Try "a mix" in Plan my week for variety.`);
  else if (planned >= 6) notes.push(`${planned} meals planned across ${mix.length} cuisines in eight weeks.`);
  return notes.slice(0, 4);
}
