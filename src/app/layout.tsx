import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/toast";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

// AinaDara type: Outfit (body, light default), DM Serif Display (titles),
// JetBrains Mono (numerals/code). Self-hosted by next/font at build time.
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display-face",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  display: "swap",
});

// Set data-theme before first paint so there is no flash of the wrong theme.
const themeInit = `(function(){try{var k='pantry-pal-theme';var q=new URLSearchParams(location.search).get('theme');var t=(q==='light'||q==='dark')?q:localStorage.getItem(k);if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);if(q==='light'||q==='dark'){localStorage.setItem(k,t);}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Pantry Pal — Cook more, waste less",
  description:
    "Smart pantry inventory, recipes from what you have, meal planning, and savings tracking.",
  applicationName: "Pantry Pal",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pantry Pal",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf5ed" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1815" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${outfit.variable} ${dmSerif.variable} ${jetBrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <ServiceWorkerRegister />
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
