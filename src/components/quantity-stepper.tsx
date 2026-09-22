"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

/**
 * Inline +/- quantity control. Updates optimistically and debounces the write
 * so rapid taps coalesce into one save. Stays in sync if the item changes from
 * elsewhere while idle.
 */
export function QuantityStepper({
  quantity,
  unit,
  onChange,
}: {
  quantity: number;
  unit: string;
  onChange: (q: number) => void;
}) {
  const [qty, setQty] = useState(quantity);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQty(quantity);
  }, [quantity]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function step(delta: number) {
    setQty((q) => {
      const next = Math.max(0, Math.round((q + delta) * 100) / 100);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => onChange(next), 500);
      return next;
    });
  }

  const buttonClass =
    "grid size-10 cursor-pointer place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="inline-flex items-center rounded-lg border border-[var(--border)]">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => step(-1)}
        disabled={qty <= 0}
        className={buttonClass}
      >
        <Minus className="size-3.5" />
      </button>
      <span className="min-w-[3.5ch] text-center text-sm font-medium tabular-nums">
        {qty}
      </span>
      <span className="pr-1 text-xs text-[var(--text-muted)]">{unit}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => step(1)}
        className={buttonClass}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
