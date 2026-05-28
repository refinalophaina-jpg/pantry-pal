"use client";

import { useState } from "react";
import { ChefHat, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Recipe } from "@/lib/types";
import { useSyncedActions } from "@/lib/data-sync";
import { Badge, Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

export function CookMode({
  recipe,
  onClose,
}: {
  recipe: Recipe;
  onClose: () => void;
}) {
  const { cookRecipe } = useSyncedActions();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<boolean[]>(
    () => recipe.steps.map(() => false),
  );
  const total = recipe.steps.length;
  const allDone = done.every(Boolean);

  function toggleStep(i: number) {
    setDone((arr) => arr.map((v, idx) => (idx === i ? !v : v)));
  }

  async function finish() {
    try {
      const result = await cookRecipe(recipe.id);
      if (!result.ok) {
        toast(`Missing: ${result.missing.join(", ")}`, "warn");
        return;
      }
      toast(`${recipe.name} cooked — pantry updated.`);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Cook failed", "warn");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg)] flex flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-8 py-4 flex items-center gap-4">
        <button
          onClick={onClose}
          aria-label="Exit cook mode"
          className="size-9 grid place-items-center rounded-lg hover:bg-[var(--bg)] cursor-pointer"
        >
          <X className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
            <ChefHat className="size-3" /> Cook mode
          </div>
          <div className="font-semibold truncate">{recipe.name}</div>
        </div>
        <Badge tone="info">
          Step {Math.min(step + 1, total)} / {total}
        </Badge>
      </header>

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-3xl mx-auto w-full">
        <div className="mb-6 flex gap-1">
          {recipe.steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i < step
                  ? "bg-[var(--accent)]"
                  : i === step
                    ? "bg-[var(--accent-hover)]"
                    : "bg-[var(--border)]",
              )}
            />
          ))}
        </div>

        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 sm:p-8 mb-6">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
            Step {step + 1}
          </div>
          <p className="text-xl sm:text-2xl leading-relaxed">
            {recipe.steps[step]}
          </p>
          <button
            onClick={() => toggleStep(step)}
            className={cn(
              "mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer",
              done[step]
                ? "bg-[var(--accent-soft)] text-[var(--accent-hover)]"
                : "border border-[var(--border)] hover:bg-[var(--bg)]",
            )}
          >
            <Check className="size-4" />
            {done[step] ? "Marked done" : "Mark done"}
          </button>
        </div>

        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-5">
          <div className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">
            Will deduct from pantry
          </div>
          <ul className="space-y-1.5 text-sm">
            {recipe.ingredients
              .filter((i) => !i.optional)
              .map((ing) => (
                <li key={ing.name} className="flex justify-between">
                  <span>{ing.name}</span>
                  <span className="text-[var(--text-muted)]">
                    −{ing.quantity}
                    {ing.unit}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      </div>

      <footer className="border-t border-[var(--border)] bg-[var(--surface)] px-4 sm:px-8 py-4 flex items-center gap-3 max-w-3xl mx-auto w-full">
        <Button
          variant="secondary"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft className="size-4" /> Back
        </Button>
        {step < total - 1 ? (
          <Button
            className="ml-auto"
            onClick={() => setStep((s) => s + 1)}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button
            className="ml-auto"
            onClick={finish}
            disabled={!allDone}
            title={allDone ? "" : "Mark all steps done first"}
          >
            <Check className="size-4" /> I cooked this
          </Button>
        )}
      </footer>
    </div>
  );
}
