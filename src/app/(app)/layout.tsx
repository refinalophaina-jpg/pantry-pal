"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DataSync } from "@/lib/data-sync";
import { Sidebar, MobileNav } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { loading, error, user, household } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || error) return;
    if (!user) router.replace("/sign-in");
    else if (!household) router.replace("/onboarding");
  }, [loading, error, user, household, router]);

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-sm text-[var(--text-muted)]">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm font-medium underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (loading || !user || !household) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-sm text-[var(--text-muted)]">Loading…</div>
      </div>
    );
  }

  return (
    <DataSync>
      <CommandPalette />
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 px-4 sm:px-8 py-6 lg:py-10 pb-24 lg:pb-10 max-w-[1400px] mx-auto w-full">
          {/* key on pathname so each navigation replays the entrance */}
          <div key={pathname} className="animate-in">
            {children}
          </div>
        </main>
        <MobileNav />
      </div>
    </DataSync>
  );
}
