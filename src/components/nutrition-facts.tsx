"use client";

/**
 * Compact nutrition-facts panel for a scanned product — a quiet nod to the
 * printed label: per-100g values, calories leading, Nutri-Score as a small
 * grade chip when Open Food Facts knows it.
 */

import type { ProductNutrition } from "@/lib/barcode";

const SCORE_COLOR: Record<string, string> = {
  a: "var(--fresh)",
  b: "var(--fresh)",
  c: "var(--warn)",
  d: "var(--warn)",
  e: "var(--danger)",
};

function Row({
  label,
  value,
  unit,
  indent,
}: {
  label: string;
  value: number | undefined;
  unit: string;
  indent?: boolean;
}) {
  if (value === undefined) return null;
  return (
    <div
      className={`flex justify-between gap-4 py-1 border-b border-[var(--rule)] last:border-b-0 ${
        indent ? "pl-4" : ""
      }`}
    >
      <dt className={indent ? "text-[var(--text-faint)]" : "text-[var(--text-muted)]"}>
        {label}
      </dt>
      <dd className="font-medium tabular-nums">
        {Math.round(value * 10) / 10}
        <span className="text-[var(--text-faint)] font-normal"> {unit}</span>
      </dd>
    </div>
  );
}

export function NutritionFacts({
  nutrition,
  servingSize,
  nutriScore,
}: {
  nutrition: ProductNutrition;
  servingSize?: string;
  nutriScore?: string;
}) {
  return (
    <section
      aria-label="Nutrition facts"
      className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-sm"
    >
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-serif text-base">Nutrition facts</h3>
        {nutriScore && (
          <span
            className="text-xs font-semibold uppercase rounded px-1.5 py-0.5 text-[var(--paper)]"
            style={{ background: SCORE_COLOR[nutriScore] ?? "var(--text-faint)" }}
            title={`Nutri-Score ${nutriScore.toUpperCase()}`}
          >
            Nutri-Score {nutriScore}
          </span>
        )}
      </div>
      <p className="text-xs text-[var(--text-faint)] mb-2">
        Per 100 g{servingSize ? ` · serving ${servingSize}` : ""}
      </p>
      <dl>
        <Row label="Calories" value={nutrition.calories} unit="kcal" />
        <Row label="Fat" value={nutrition.fatG} unit="g" />
        <Row label="Saturated fat" value={nutrition.saturatedFatG} unit="g" indent />
        <Row label="Carbohydrates" value={nutrition.carbsG} unit="g" />
        <Row label="Sugars" value={nutrition.sugarsG} unit="g" indent />
        <Row label="Fiber" value={nutrition.fiberG} unit="g" />
        <Row label="Protein" value={nutrition.proteinG} unit="g" />
        <Row label="Sodium" value={nutrition.sodiumMg} unit="mg" />
      </dl>
    </section>
  );
}
