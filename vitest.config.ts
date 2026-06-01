import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Test runner config. We keep it independent of next.config (static export):
// jsdom for component tests, the "@/" alias mirrored from tsconfig, and a
// dummy Supabase env so modules that lazily read it can be imported safely.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    },
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["src/lib/**/*.ts", "src/components/**/*.tsx"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    },
  },
});
