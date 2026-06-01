"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui";
import { searchIngredients, type Ingredient } from "@/lib/food-db";

/**
 * Map a consortium ingredient category onto the pantry's category buckets,
 * so picking a suggestion can auto-fill a valid <Select> option.
 */
const PANTRY_CATEGORY: Record<string, string> = {
  Produce: "Produce",
  "Dairy & Eggs": "Dairy",
  "Meat & Seafood": "Protein",
  "Grains & Bread": "Grains",
  "Legumes & Nuts": "Protein",
  "Oils & Condiments": "Oils",
  "Pantry & Spices": "Pantry staple",
};

export function pantryCategoryFor(consortiumCategory: string): string {
  return PANTRY_CATEGORY[consortiumCategory] ?? "Other";
}

export function IngredientAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Fired when a suggestion is chosen (click / Enter). */
  onSelect?: (ingredient: Ingredient) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [results, setResults] = useState<Ingredient[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search; ignores stale responses and fails soft (offline/anon).
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const found = await searchIngredients(q, 8);
        if (!cancelled) {
          setResults(found);
          setActive(-1);
        }
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value]);

  // Close when clicking outside.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(ing: Ingredient) {
    onChange(ing.name);
    onSelect?.(ing);
    setOpen(false);
    setResults([]);
  }

  const showList = open && results.length > 0;

  function onKeyDown(e: React.KeyboardEvent) {
    if (!showList) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <Input
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1"
        >
          {results.map((ing, i) => (
            <li
              key={ing.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                // mousedown (not click) so it fires before input blur
                e.preventDefault();
                choose(ing);
              }}
              onMouseEnter={() => setActive(i)}
              className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between gap-2 ${
                i === active ? "bg-[var(--bg)]" : ""
              }`}
            >
              <span>{ing.name}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {ing.category}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
