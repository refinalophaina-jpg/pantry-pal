"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DataSync } from "@/lib/data-sync";
import { Sidebar, MobileNav } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { loading, user, household } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/sign-in");
    else if (!household) router.replace("/onboarding");
  }, [loading, user, household, router]);

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
