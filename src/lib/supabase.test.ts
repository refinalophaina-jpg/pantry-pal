import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Stub the SSR client so no real connection is attempted.
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({ __mock: true })),
}));

beforeEach(() => {
  vi.resetModules(); // reset the module-level memoized client between tests
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSupabase", () => {
  it("throws a helpful error when env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const { getSupabase } = await import("./supabase");
    expect(() => getSupabase()).toThrow(/Missing NEXT_PUBLIC_SUPABASE/);
  });

  it("creates the client once and memoizes it", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const { getSupabase } = await import("./supabase");
    const a = getSupabase();
    const b = getSupabase();
    expect(a).toBe(b); // same instance
  });
});
