import { describe, it, expect } from "vitest";
import { storeFinderUrl, SUGGESTED_STORES } from "./stores";

describe("storeFinderUrl", () => {
  it("builds a url-encoded Google Maps search for the store near a zip", () => {
    const url = storeFinderUrl("H-E-B", "77056");
    expect(url.startsWith("https://www.google.com/maps/search/")).toBe(true);
    expect(url).toContain(encodeURIComponent("H-E-B grocery near 77056"));
  });
});

describe("SUGGESTED_STORES", () => {
  it("offers a non-empty list of starter stores", () => {
    expect(SUGGESTED_STORES.length).toBeGreaterThan(0);
    expect(SUGGESTED_STORES).toContain("Walmart");
  });
});
