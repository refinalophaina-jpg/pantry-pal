import type { CapacitorConfig } from "@capacitor/cli";

/*
 * Capacitor wraps the Next.js static export (`out/`) in a native iOS/Android
 * shell. Build the web app first (`npm run build`), then `npx cap sync`.
 *
 * The app talks to Supabase over the network at runtime, so no bundled server
 * is needed — Capacitor serves the static assets from localhost inside the
 * native WebView.
 */
const config: CapacitorConfig = {
  appId: "com.ainadara.pantrypal",
  appName: "Pantry Pal",
  webDir: "out",
  backgroundColor: "#faf5ed",
  ios: {
    contentInset: "always",
    backgroundColor: "#faf5ed",
  },
  android: {
    backgroundColor: "#faf5ed",
  },
};

export default config;
