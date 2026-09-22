"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DataSync } from "@/lib/data-sync";
import { Sidebar, MobileNav } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { loading, error, user, household } = useAuth();
  const router = useRouter();

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
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8 pb-24 lg:pb-10">
          {children}
        </main>
        <MobileNav />
      </div>
    </DataSync>
  );
}
