"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Refrigerator,
  ChefHat,
  Globe2,
  GraduationCap,
  CalendarDays,
  ShoppingCart,
  TrendingUp,
  SunMoon,
  Search,
  CornerDownLeft,
  Plus,
} from "lucide-react";
import { applyTheme, currentTheme } from "@/components/theme-toggle";
import { useSyncedActions } from "@/lib/data-sync";
import { useToast } from "@/components/toast";
import { searchIngredients, type Ingredient } from "@/lib/food-db";
import { pantryCategoryFor } from "@/components/ingredient-autocomplete";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  group: string;
  icon: ComponentType<{ className?: string }>;
  run: () => void;
}

/**
 * App-wide command palette (⌘K / Ctrl+K). Quick navigation + actions, with
 * fuzzy filtering and full keyboard control. Mounted once in the app layout.
 */
export function CommandPalette() {
  const router = useRouter();
  const { addPantryItem } = useSyncedActions();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);

  const addToPantry = useCallback(
    async (ing: Ingredient) => {
      setOpen(false);
      try {
        await addPantryItem({
          name: ing.name,
          category: pantryCategoryFor(ing.category),
          quantity: 1,
          unit: "pcs",
          zone: "pantry",
        });
        toast(`${ing.name} added to pantry.`);
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Couldn't add to pantry",
          "warn",
        );
      }
    },
    [addPantryItem, toast],
  );

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    return [
      { id: "nav-dashboard", label: "Go to Dashboard", group: "Navigate", icon: LayoutDashboard, run: go("/") },
      { id: "nav-pantry", label: "Go to Pantry", group: "Navigate", icon: Refrigerator, run: go("/pantry") },
      { id: "nav-recipes", label: "Go to My Recipes", group: "Navigate", icon: ChefHat, run: go("/recipes") },
      { id: "nav-explore", label: "Go to Explore", group: "Navigate", icon: Globe2, run: go("/explore") },
      { id: "nav-learn", label: "Go to Learn", group: "Navigate", icon: GraduationCap, run: go("/learn") },
      { id: "nav-meal-plan", label: "Go to Meal Plan", group: "Navigate", icon: CalendarDays, run: go("/meal-plan") },
      { id: "nav-shopping", label: "Go to Shopping", group: "Navigate", icon: ShoppingCart, run: go("/shopping") },
      { id: "nav-analytics", label: "Go to Analytics", group: "Navigate", icon: TrendingUp, run: go("/analytics") },
      {
        id: "theme",
        label: "Toggle light / dark theme",
        group: "Actions",
        icon: SunMoon,
        run: () => applyTheme(currentTheme() === "dark" ? "light" : "dark"),
      },
    ];
  }, [router]);

  // Live ingredient search from the consortium (debounced, fails soft).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setIngredients([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const found = await searchIngredients(q, 5);
        if (!cancelled) setIngredients(found);
      } catch {
        if (!cancelled) setIngredients([]);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const staticMatches = q
      ? commands.filter((c) => c.label.toLowerCase().includes(q))
      : commands;
    const ingredientCommands: Command[] = ingredients.map((ing) => ({
      id: `ing-${ing.id}`,
      label: `Add “${ing.name}” to pantry`,
      group: "Add to pantry",
      icon: Plus,
      run: () => addToPantry(ing),
    }));
    return [...staticMatches, ...ingredientCommands];
  }, [commands, query, ingredients, addToPantry]);

  // Global ⌘K / Ctrl+K toggles; Escape closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Reset query/selection each time it opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  // Keep the active index in range as the filtered list shrinks.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const run = useCallback((c: Command) => {
    setOpen(false);
    c.run();
  }, []);

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && filtered[active]) {
      e.preventDefault();
      run(filtered[active]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        className="w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl overflow-hidden animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-[var(--border)]">
          <Search className="size-4 text-[var(--text-muted)] shrink-0" />
          <input
            autoFocus
            aria-label="Search commands"
            placeholder="Type a command or search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            className="w-full bg-transparent py-3.5 text-sm outline-none"
          />
        </div>
        <ul role="listbox" className="max-h-80 overflow-auto py-2">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
              No commands match “{query}”.
            </li>
          )}
          {filtered.map((c, i) => {
            const Icon = c.icon;
            return (
              <li
                key={c.id}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  run(c);
                }}
                className={cn(
                  "mx-2 px-3 py-2 rounded-lg flex items-center gap-3 text-sm cursor-pointer",
                  i === active
                    ? "bg-[var(--accent-soft)] text-[var(--accent-hover)]"
                    : "text-[var(--text)]",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{c.label}</span>
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                  {c.group}
                </span>
                {i === active && (
                  <CornerDownLeft className="size-3.5 text-[var(--text-muted)]" />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
