"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Refrigerator,
  ChefHat,
  CalendarDays,
  ShoppingCart,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pantry", label: "Pantry", icon: Refrigerator },
  { href: "/recipes", label: "Recipes", icon: ChefHat },
  { href: "/meal-plan", label: "Meal Plan", icon: CalendarDays },
  { href: "/shopping", label: "Shopping", icon: ShoppingCart },
  { href: "/analytics", label: "Analytics", icon: TrendingUp },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:flex lg:w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] sticky top-0 h-screen">
      <div className="p-6 flex items-center gap-2">
        <div className="size-9 rounded-xl bg-[var(--accent)] text-white grid place-items-center">
          <Sparkles className="size-5" />
        </div>
        <div>
          <div className="text-lg font-semibold leading-tight">Pantry Pal</div>
          <div className="text-xs text-[var(--text-muted)]">
            Cook more · waste less
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {nav.map((n) => {
          const Icon = n.icon;
          const active =
            n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent-hover)] font-medium"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]",
              )}
            >
              <Icon className="size-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 text-xs text-[var(--text-muted)] border-t border-[var(--border)]">
        v0.1 · local-only data
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--surface)] border-t border-[var(--border)] flex">
      {nav.map((n) => {
        const Icon = n.icon;
        const active =
          n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px]",
              active
                ? "text-[var(--accent-hover)]"
                : "text-[var(--text-muted)]",
            )}
          >
            <Icon className="size-5" />
            {n.label.split(" ")[0]}
          </Link>
        );
      })}
    </nav>
  );
}
