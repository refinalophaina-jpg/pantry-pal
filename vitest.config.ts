import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Test runner config. We keep it independent of next.config (static export):
// jsdom for component tests, with the "@/" alias mirrored from tsconfig.
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
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      include: ["src/lib/**/*.ts", "src/components/**/*.tsx"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    },
  },
});
