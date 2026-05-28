"use client";

import { useState } from "react";
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
  LogOut,
  Users,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Button, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";

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
  const { user, household, signOut } = useAuth();
  const [showInvite, setShowInvite] = useState(false);
  return (
    <aside className="hidden lg:flex lg:w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] sticky top-0 h-screen">
      <div className="p-6 flex items-center gap-2">
        <div className="size-9 rounded-xl bg-[var(--accent)] text-white grid place-items-center">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold leading-tight">Pantry Pal</div>
          <div className="text-xs text-[var(--text-muted)] truncate">
            {household?.name ?? "Cook more · waste less"}
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
      <div className="p-4 border-t border-[var(--border)] space-y-2">
        {household && (
          <button
            onClick={() => setShowInvite(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] cursor-pointer"
          >
            <Users className="size-4" /> Invite partner
          </button>
        )}
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] cursor-pointer"
        >
          <LogOut className="size-4" /> Sign out
        </button>
        <div className="text-[10px] text-[var(--text-muted)] truncate pl-3">
          {user?.email}
        </div>
      </div>
      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} />
    </aside>
  );
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { household, createInvite } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    const r = await createInvite();
    setBusy(false);
    if (r.error) {
      toast(r.error, "warn");
      return;
    }
    setCode(r.code ?? null);
  }

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite to household">
      <p className="text-sm text-[var(--text-muted)] mb-4">
        Share this code with the people in <strong>{household?.name}</strong>.
        It expires in 7 days and can only be used once.
      </p>
      {code ? (
        <div className="border border-[var(--border)] rounded-lg p-4 mb-4 bg-[var(--bg)] text-center">
          <div className="font-mono text-2xl font-semibold tracking-widest">
            {code}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={copy}
          >
            {copied ? (
              <>
                <Check className="size-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="size-4" /> Copy
              </>
            )}
          </Button>
        </div>
      ) : (
        <Button onClick={generate} disabled={busy} className="w-full">
          {busy ? "Generating…" : "Generate invite code"}
        </Button>
      )}
      <div className="flex justify-end mt-4">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
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
