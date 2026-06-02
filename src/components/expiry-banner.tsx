"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, BellOff, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { Button, Card } from "@/components/ui";
import { daysUntil } from "@/lib/utils";
import { useMounted } from "@/lib/use-mounted";

const DISMISS_KEY = "pantry-pal-expiry-dismissed";

export function ExpiryBanner() {
  const mounted = useMounted();
  const pantry = useAppStore((s) => s.pantry);
  const [dismissed, setDismissed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );

  useEffect(() => {
    if (!mounted) return;
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    const dismissedToday = localStorage.getItem(DISMISS_KEY);
    if (dismissedToday === new Date().toDateString()) setDismissed(true);
  }, [mounted]);

  const urgent = useMemo(
    () =>
      pantry
        .map((p) => ({ p, d: daysUntil(p.expiresOn) }))
        .filter(({ d }) => d !== null && d <= 1),
    [pantry],
  );

  // Fire one browser notification per item per session if allowed.
  useEffect(() => {
    if (!mounted) return;
    if (permission !== "granted") return;
    const sessionKey = "pantry-pal-notified";
    let notified: string[] = [];
    try {
      notified = JSON.parse(sessionStorage.getItem(sessionKey) ?? "[]");
    } catch {
      notified = [];
    }
    const now = notified.slice();
    urgent.forEach(({ p, d }) => {
      if (now.includes(p.id)) return;
      new Notification("Pantry Pal", {
        body:
          d === 0
            ? `${p.name} expires today.`
            : d! < 0
              ? `${p.name} expired ${Math.abs(d!)}d ago.`
              : `${p.name} expires in ${d} day${d === 1 ? "" : "s"}.`,
      });
      now.push(p.id);
    });
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify(now));
    } catch {
      // sessionStorage full or unavailable — notifications still fired.
    }
  }, [mounted, urgent, permission]);

  if (!mounted) return null;
  if (urgent.length === 0) return null;
  if (dismissed) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, new Date().toDateString());
    setDismissed(true);
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  return (
    <Card className="mb-4 border-[var(--warn)] bg-[var(--warn-soft)] relative">
      <button
        onClick={dismiss}
        className="absolute right-3 top-3 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="size-9 rounded-lg grid place-items-center bg-[var(--warn)] text-white shrink-0">
          <AlertTriangle className="size-5" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-[var(--warn)]">
            {urgent.length} item{urgent.length === 1 ? " needs" : "s need"}{" "}
            attention
          </div>
          <div className="text-sm text-[var(--text)] mt-0.5">
            {urgent
              .slice(0, 3)
              .map(({ p, d }) => {
                const when =
                  d! < 0
                    ? `expired ${Math.abs(d!)}d ago`
                    : d === 0
                      ? "expires today"
                      : `expires in ${d}d`;
                return `${p.name} (${when})`;
              })
              .join(" · ")}
            {urgent.length > 3 && ` · +${urgent.length - 3} more`}
          </div>
          {permission === "default" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={enableNotifications}
              className="mt-3"
            >
              <Bell className="size-3.5" /> Enable browser alerts
            </Button>
          )}
          {permission === "denied" && (
            <div className="text-xs text-[var(--text-muted)] mt-3 flex items-center gap-1">
              <BellOff className="size-3.5" /> Browser alerts blocked — enable
              in site settings.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
