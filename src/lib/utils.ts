import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInCalendarDays, format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  return differenceInCalendarDays(parseISO(iso), new Date());
}

export function expiryStatus(iso?: string): {
  label: string;
  tone: "fresh" | "soon" | "today" | "expired" | "none";
} {
  const d = daysUntil(iso);
  if (d === null) return { label: "No expiry", tone: "none" };
  if (d < 0) return { label: `Expired ${Math.abs(d)}d ago`, tone: "expired" };
  if (d === 0) return { label: "Expires today", tone: "today" };
  if (d <= 3) return { label: `${d}d left`, tone: "soon" };
  return { label: `${d}d left`, tone: "fresh" };
}

export function fmtDate(iso: string) {
  return format(parseISO(iso), "MMM d");
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
