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

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => step(-1)}
        disabled={qty <= 0}
        className="size-7 grid place-items-center rounded-lg border border-[var(--border)] hover:bg-[var(--bg)] disabled:opacity-40 cursor-pointer"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="text-xl font-semibold tabular-nums min-w-[2ch] text-center">
        {qty}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => step(1)}
        className="size-7 grid place-items-center rounded-lg border border-[var(--border)] hover:bg-[var(--bg)] cursor-pointer"
      >
        <Plus className="size-3.5" />
      </button>
      <span className="text-sm text-[var(--text-muted)]">{unit}</span>
    </div>
  );
}

