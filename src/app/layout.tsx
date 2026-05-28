import type { Metadata } from "next";
import "./globals.css";
import { Sidebar, MobileNav } from "@/components/sidebar";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: "Pantry Pal — Cook more, waste less",
  description:
    "Smart pantry inventory, recipes from what you have, meal planning, and savings tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 px-4 sm:px-8 py-6 lg:py-10 pb-24 lg:pb-10 max-w-[1400px] mx-auto w-full">
              {children}
            </main>
          </div>
          <MobileNav />
        </ToastProvider>
      </body>
    </html>
  );
}
