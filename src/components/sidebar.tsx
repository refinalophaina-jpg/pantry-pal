"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Refrigerator,
  ChefHat,
  CalendarDays,
  ShoppingCart,
  TrendingUp,
  LogOut,
  Users,
  Copy,
  Check,
  Globe2,
  GraduationCap,
  Search,
  MoreHorizontal,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Button, Modal } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/components/toast";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pantry", label: "Pantry", icon: Refrigerator },
  { href: "/recipes", label: "My Recipes", icon: ChefHat },
  { href: "/explore", label: "Explore", icon: Globe2 },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/meal-plan", label: "Meal Plan", icon: CalendarDays },
  { href: "/shopping", label: "Shopping", icon: ShoppingCart },
  { href: "/analytics", label: "Analytics", icon: TrendingUp },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, household, signOut } = useAuth();
  const [showInvite, setShowInvite] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  return (
    <aside className="hidden lg:flex lg:w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] sticky top-0 h-screen">
      <div className="p-6 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/illustrations/logo.svg"
          alt="Pantry Pal"
          className="size-9 rounded-xl shadow-sm"
          draggable={false}
        />
        <div className="min-w-0">
          <div className="text-lg font-semibold leading-tight">Pantry Pal</div>
          <div className="text-xs text-[var(--text-muted)] truncate">
            {household?.name ?? "Cook more · waste less"}
          </div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <button
          onClick={() =>
            document.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", metaKey: true }),
            )
          }
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] bg-[var(--bg)] border border-[var(--border)] hover:text-[var(--text)] cursor-pointer"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)]">
            ⌘K
          </kbd>
        </button>
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
              aria-current={active ? "page" : undefined}
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
        <ThemeToggle />
        {user?.isAnonymous && <button type="button" onClick={() => setShowRecovery(true)} className="min-h-11 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--bg)]"><KeyRound className="size-4" />Guest recovery code</button>}
        {household && (
          <button
            onClick={() => setShowInvite(true)}
            className="min-h-11 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] cursor-pointer"
          >
            <Users className="size-4" /> Invite partner
          </button>
        )}
        <button
          onClick={() => signOut()}
          className="min-h-11 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] cursor-pointer"
        >
          <LogOut className="size-4" /> Sign out
        </button>
        <div className="text-[10px] text-[var(--text-muted)] truncate pl-3">
          {user?.isAnonymous ? "Guest · remembered on this browser" : user?.email}
        </div>
        {user?.isAnonymous && <p className="px-3 text-xs text-[var(--text-muted)]">Save a recovery code before signing out.</p>}
      </div>
      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} />
      <GuestRecoveryModal open={showRecovery} onClose={() => setShowRecovery(false)} />
    </aside>
  );
}

function GuestRecoveryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, rotateGuestRecovery } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setCode(null); setCopied(false); }, [open, user?.id]);
  async function generate() {
    setBusy(true);
    try {
      const result = await rotateGuestRecovery();
      if (result.error) toast(result.error, "warn");
      else setCode(result.recoveryCode ?? null);
    } catch { toast("Could not create a recovery code. Please retry.", "warn"); }
    finally { setBusy(false); }
  }
  async function copy() {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); setCopied(true); }
    catch { toast("Copy is unavailable. Select and copy the code below.", "warn"); }
  }
  return <Modal open={open} onClose={onClose} title="Guest recovery code">
    <p className="text-sm text-[var(--text-muted)] mb-4">This browser remembers your guest pantry. Save a recovery code to open it on another browser or after clearing browser data.</p>
    <p className="text-sm mb-4">Anyone with your code can open this guest pantry. Keep it private. Creating a code replaces any previous code.</p>
    {code ? <div className="space-y-3">
      <p className="text-sm font-medium">Save this code now. It is shown only once.</p>
      <output aria-label="Recovery code" className="block break-all select-all rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 font-mono text-base">{code}</output>
      <Button className="w-full" variant="secondary" onClick={copy}><Copy className="size-4" />{copied ? "Copied" : "Copy recovery code"}</Button>
    </div> : <Button className="w-full" onClick={generate} disabled={busy}>{busy ? "Creating…" : "Create or replace recovery code"}</Button>}
    <div className="flex justify-end mt-4"><Button variant="ghost" onClick={onClose}>{code ? "I saved my code" : "Close"}</Button></div>
  </Modal>;
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { household, createInvite } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setCode(null); setCopied(false); }, [household?.id, open]);

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
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { toast("Copy is unavailable. Select and copy the invite code below.", "warn"); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite to household">
      <p className="text-sm text-[var(--text-muted)] mb-4">
        Share this code with the people in <strong>{household?.name}</strong>.
        It expires in 7 days and can only be used once.
      </p>
      {code ? (
        <div className="border border-[var(--border)] rounded-lg p-4 mb-4 bg-[var(--bg)] text-center">
          <div className="font-mono text-lg sm:text-2xl font-semibold tracking-wider break-all select-all">
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
  const { user, household, signOut } = useAuth();
  const [more, setMore] = useState(false);
  const [invite, setInvite] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const primary = [nav[0], nav[1], nav[2], nav[6]];
  const secondary = nav.filter((item) => !primary.includes(item));
  const overflowActive = secondary.some((item) => pathname.startsWith(item.href));
  function search() {
    setMore(false);
    // Let the account dialog release modal focus before the palette opens.
    setTimeout(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true })), 0);
  }
  return <>
    <nav aria-label="Primary mobile navigation" className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--surface)] border-t border-[var(--border)] grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
      {primary.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
          className={cn("min-h-14 min-w-0 flex flex-col items-center justify-center gap-1 py-2 text-[11px]", active ? "text-[var(--accent-hover)] font-semibold" : "text-[var(--text-muted)]")}>
          <Icon className="size-5" aria-hidden="true" />{item.href === "/" ? "Home" : item.href === "/recipes" ? "Recipes" : item.label}
        </Link>;
      })}
      <button type="button" aria-haspopup="dialog" aria-expanded={more} onClick={(event) => { event.currentTarget.focus(); setMore(true); }} className={cn("min-h-14 flex flex-col items-center justify-center gap-1 py-2 text-[11px]", overflowActive ? "text-[var(--accent-hover)] font-semibold" : "text-[var(--text-muted)]")}>
        <MoreHorizontal className="size-5" aria-hidden="true" />More
      </button>
    </nav>
    <Modal open={more} onClose={() => setMore(false)} title="More and account">
      <p className="text-sm font-medium break-words">{household?.name}</p>
      <p className="mb-4 text-sm text-[var(--text-muted)] break-all">{user?.isAnonymous ? "Guest · remembered on this browser" : user?.email}</p>
      {user?.isAnonymous && <p className="mb-4 text-sm text-[var(--text-muted)]">Save a recovery code before signing out.</p>}
      <nav aria-label="More destinations" className="grid grid-cols-2 gap-2">
        {secondary.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMore(false)} aria-current={pathname.startsWith(href) ? "page" : undefined} className="min-h-12 flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"><Icon className="size-4 shrink-0" />{label}</Link>)}
      </nav>
      <div className="mt-4 space-y-1 border-t border-[var(--border)] pt-3">
        <button type="button" className="min-h-11 w-full flex items-center gap-3 px-3 py-2 text-sm" onClick={search}><Search className="size-4" />Search pantry and recipes</button>
        <ThemeToggle className="min-h-11" />
        {user?.isAnonymous && <button type="button" className="min-h-11 w-full flex items-center gap-3 px-3 py-2 text-sm" onClick={() => { setMore(false); setRecovery(true); }}><KeyRound className="size-4" />Guest recovery code</button>}
        {household && <button type="button" className="min-h-11 w-full flex items-center gap-3 px-3 py-2 text-sm" onClick={() => { setMore(false); setInvite(true); }}><Users className="size-4" />Invite partner</button>}
        <Link href="/offline-shopping/" className="min-h-11 w-full flex items-center gap-3 px-3 py-2 text-sm" onClick={() => setMore(false)}><ShoppingCart className="size-4" />Saved shopping list</Link>
        <button type="button" className="min-h-11 w-full flex items-center gap-3 px-3 py-2 text-sm" onClick={() => { setMore(false); void signOut(); }}><LogOut className="size-4" />Sign out</button>
      </div>
    </Modal>
    <InviteModal open={invite} onClose={() => setInvite(false)} />
    <GuestRecoveryModal open={recovery} onClose={() => setRecovery(false)} />
  </>;
}
