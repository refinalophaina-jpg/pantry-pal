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
  ChartColumn,
  LogOut,
  Users,
  Copy,
  Check,
  Compass,
  BookOpen,
  CookingPot,
  Search,
  MoreHorizontal,
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Button, Modal } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/components/toast";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

// Everyday destinations first; browsing and review below a hairline.
const primaryNav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pantry", label: "Pantry", icon: Refrigerator },
  { href: "/recipes", label: "My Recipes", icon: ChefHat },
  { href: "/meal-plan", label: "Meal Plan", icon: CalendarDays },
  { href: "/shopping", label: "Shopping", icon: ShoppingCart },
];
const secondaryNav: NavItem[] = [
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/prep", label: "Three-day Prep", icon: CookingPot },
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
];
const nav = [...primaryNav, ...secondaryNav];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function openSearch() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
}

const rowClass =
  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] cursor-pointer";

function NavLink({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed: boolean }) {
  const Icon = item.icon;
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-lg text-sm transition-colors",
        collapsed ? "justify-center px-0" : "px-3 py-1.5",
        active
          ? "bg-[var(--bg)] font-medium text-[var(--text)]"
          : "text-[var(--text-muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active && "text-[var(--accent-hover)]")} aria-hidden="true" />
      {!collapsed && item.label}
    </Link>
  );
}

const COLLAPSE_KEY = "pantry-pal-sidebar-collapsed";
function readCollapsed() {
  try { return typeof window !== "undefined" && localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, household, signOut } = useAuth();
  const [showInvite, setShowInvite] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  // The sidebar only renders after sign-in on the client, so reading the
  // preference during the first render cannot disagree with server HTML.
  const [collapsed, setCollapsed] = useState(readCollapsed);
  function toggleCollapsed() {
    setCollapsed((value) => {
      try { localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1"); } catch { /* preference stays for this visit */ }
      return !value;
    });
  }
  const iconRow = (label: string) => cn(rowClass, collapsed && "justify-center px-0");
  const withLabel = (label: string, Icon: typeof LogOut) => (
    <>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {!collapsed && label}
    </>
  );
  return (
    <aside className={cn("sticky top-0 hidden h-screen flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-200 lg:flex", collapsed ? "lg:w-16" : "lg:w-60")}>
      <div className={cn("flex items-center gap-3 pb-3 pt-6", collapsed ? "justify-center px-2" : "px-5")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/logo.svg" alt="" aria-hidden="true" className="size-8 rounded-lg" draggable={false} />
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-medium leading-tight">Pantry Pal</div>
            {household && (
              <div className="truncate text-xs text-[var(--text-muted)]">{household.name}</div>
            )}
          </div>
        )}
      </div>
      <div className={cn("pb-2", collapsed ? "px-2" : "px-3")}>
        <button
          type="button"
          onClick={openSearch}
          aria-label={collapsed ? "Search" : undefined}
          title={collapsed ? "Search (⌘K)" : undefined}
          className={cn("flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-sm text-[var(--text-muted)] hover:text-[var(--text)]", collapsed ? "justify-center px-0" : "px-3")}
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          {!collapsed && <>
            <span className="flex-1 text-left">Search…</span>
            <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-faint)]">
              ⌘K
            </kbd>
          </>}
        </button>
      </div>
      <nav className={cn("flex-1 overflow-y-auto py-2", collapsed ? "px-2" : "px-3")}>
        <ul className="space-y-0.5">
          {primaryNav.map((item) => (
            <li key={item.href}><NavLink item={item} pathname={pathname} collapsed={collapsed} /></li>
          ))}
        </ul>
        <ul className="mt-3 space-y-0.5 border-t border-[var(--border)] pt-3">
          {secondaryNav.map((item) => (
            <li key={item.href}><NavLink item={item} pathname={pathname} collapsed={collapsed} /></li>
          ))}
        </ul>
      </nav>
      <div className={cn("space-y-0.5 border-t border-[var(--border)] py-3", collapsed ? "px-2" : "px-3")}>
        <ThemeToggle className="min-h-10" compact={collapsed} />
        {user?.isAnonymous && (
          <button type="button" onClick={() => setShowRecovery(true)} className={iconRow("Guest recovery code")} aria-label={collapsed ? "Guest recovery code" : undefined} title={collapsed ? "Guest recovery code" : undefined}>
            {withLabel("Guest recovery code", KeyRound)}
          </button>
        )}
        {household && (
          <button type="button" onClick={() => setShowInvite(true)} className={iconRow("Invite partner")} aria-label={collapsed ? "Invite partner" : undefined} title={collapsed ? "Invite partner" : undefined}>
            {withLabel("Invite partner", Users)}
          </button>
        )}
        <button type="button" onClick={() => signOut()} className={iconRow("Sign out")} aria-label={collapsed ? "Sign out" : undefined} title={collapsed ? "Sign out" : undefined}>
          {withLabel("Sign out", LogOut)}
        </button>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-pressed={collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={iconRow("Collapse")}
        >
          {collapsed ? <PanelLeftOpen className="size-4 shrink-0" aria-hidden="true" /> : <PanelLeftClose className="size-4 shrink-0" aria-hidden="true" />}
          {!collapsed && "Collapse sidebar"}
        </button>
        {!collapsed && (
          <p className="break-words px-3 pt-2 text-xs leading-snug text-[var(--text-faint)]">
            {user?.isAnonymous ? "Guest · save a recovery code to keep this pantry" : user?.email}
          </p>
        )}
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
    <p className="mb-3 text-sm text-[var(--text-muted)]">This browser remembers your guest pantry. A recovery code opens it on another browser or after clearing browser data.</p>
    <p className="mb-4 text-sm text-[var(--text-muted)]">Anyone with the code can open this pantry, so keep it private. Creating a code replaces any previous one.</p>
    {code ? <div className="space-y-3">
      <p className="text-sm font-medium">Save this code now. It is shown only once.</p>
      <output aria-label="Recovery code" className="block break-all select-all rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 font-mono text-base">{code}</output>
      <Button className="w-full" variant="secondary" onClick={copy}><Copy className="size-4" />{copied ? "Copied" : "Copy recovery code"}</Button>
    </div> : <Button className="w-full" onClick={generate} disabled={busy}>{busy ? "Creating…" : "Create or replace recovery code"}</Button>}
    <div className="mt-4 flex justify-end"><Button variant="ghost" onClick={onClose}>{code ? "I saved my code" : "Close"}</Button></div>
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
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Share this code with the people in <strong className="font-medium text-[var(--text)]">{household?.name}</strong>.
        It expires in 7 days and can be used once.
      </p>
      {code ? (
        <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 text-center">
          <div className="break-all select-all font-mono text-lg font-medium tracking-wider sm:text-2xl">
            {code}
          </div>
          <Button variant="secondary" size="sm" className="mt-3" onClick={copy}>
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
      <div className="mt-4 flex justify-end">
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
  const primary = ["/", "/pantry", "/recipes", "/shopping"].map((href) => nav.find((item) => item.href === href)!);
  const secondary = nav.filter((item) => !primary.includes(item));
  const overflowActive = secondary.some((item) => pathname.startsWith(item.href));
  function search() {
    setMore(false);
    // Let the account dialog release modal focus before the palette opens.
    setTimeout(openSearch, 0);
  }
  return <>
    <nav aria-label="Primary mobile navigation" className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] lg:hidden">
      {primary.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
          className={cn("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 py-2 text-xs", active ? "font-medium text-[var(--accent-hover)]" : "text-[var(--text-muted)]")}>
          <Icon className="size-5" aria-hidden="true" />{item.href === "/" ? "Home" : item.href === "/recipes" ? "Recipes" : item.label}
        </Link>;
      })}
      <button type="button" aria-haspopup="dialog" aria-expanded={more} onClick={(event) => { event.currentTarget.focus(); setMore(true); }} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-xs", overflowActive ? "font-medium text-[var(--accent-hover)]" : "text-[var(--text-muted)]")}>
        <MoreHorizontal className="size-5" aria-hidden="true" />More
      </button>
    </nav>
    <Modal open={more} onClose={() => setMore(false)} title="More and account">
      <p className="break-words text-sm font-medium">{household?.name}</p>
      <p className="mb-4 break-all text-sm text-[var(--text-muted)]">{user?.isAnonymous ? "Guest · save a recovery code to keep this pantry" : user?.email}</p>
      <nav aria-label="More destinations">
        <ul className="space-y-0.5">
          {secondary.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} onClick={() => setMore(false)} aria-current={pathname.startsWith(href) ? "page" : undefined} className={cn(rowClass, pathname.startsWith(href) && "bg-[var(--bg)] font-medium text-[var(--text)]")}>
                <Icon className="size-4 shrink-0" aria-hidden="true" />{label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-3 space-y-0.5 border-t border-[var(--border)] pt-3">
        <button type="button" className={rowClass} onClick={search}><Search className="size-4" aria-hidden="true" />Search pantry and recipes</button>
        <ThemeToggle className="min-h-11" />
        {user?.isAnonymous && <button type="button" className={rowClass} onClick={() => { setMore(false); setRecovery(true); }}><KeyRound className="size-4" aria-hidden="true" />Guest recovery code</button>}
        {household && <button type="button" className={rowClass} onClick={() => { setMore(false); setInvite(true); }}><Users className="size-4" aria-hidden="true" />Invite partner</button>}
        <Link href="/offline-shopping/" className={rowClass} onClick={() => setMore(false)}><ShoppingCart className="size-4" aria-hidden="true" />Saved shopping list</Link>
        <button type="button" className={rowClass} onClick={() => { setMore(false); void signOut(); }}><LogOut className="size-4" aria-hidden="true" />Sign out</button>
      </div>
    </Modal>
    <InviteModal open={invite} onClose={() => setInvite(false)} />
    <GuestRecoveryModal open={recovery} onClose={() => setRecovery(false)} />
  </>;
}
