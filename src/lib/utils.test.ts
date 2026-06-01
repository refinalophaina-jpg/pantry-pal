import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cn,
  daysUntil,
  expiryStatus,
  fmtDate,
  dealSearchUrl,
  uid,
  todayISO,
  addDays,
} from "./utils";

describe("cn", () => {
  it("merges conflicting tailwind classes, last wins", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
  it("drops falsy conditional classes", () => {
    expect(cn("text-sm", false && "hidden", undefined, "font-bold")).toBe(
      "text-sm font-bold",
    );
  });
});

describe("date-relative helpers (fixed clock: 2026-05-31 noon local)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Local-time noon so the calendar date is unambiguous in any timezone.
    vi.setSystemTime(new Date(2026, 4, 31, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("daysUntil returns null when no date given", () => {
    expect(daysUntil()).toBeNull();
    expect(daysUntil(undefined)).toBeNull();
  });

  it("daysUntil counts calendar days to a future/past date", () => {
    expect(daysUntil("2026-06-03")).toBe(3);
    expect(daysUntil("2026-05-31")).toBe(0);
    expect(daysUntil("2026-05-28")).toBe(-3);
  });

  it("expiryStatus maps day deltas to tones", () => {
    expect(expiryStatus()).toEqual({ label: "No expiry", tone: "none" });
    expect(expiryStatus("2026-05-28")).toEqual({
      label: "Expired 3d ago",
      tone: "expired",
    });
    expect(expiryStatus("2026-05-31")).toEqual({
      label: "Expires today",
      tone: "today",
    });
    expect(expiryStatus("2026-06-02")).toEqual({ label: "2d left", tone: "soon" });
    expect(expiryStatus("2026-06-10")).toEqual({
      label: "10d left",
      tone: "fresh",
    });
  });

  it("todayISO / addDays produce YYYY-MM-DD strings around now", () => {
    expect(todayISO()).toBe("2026-05-31");
    expect(addDays(3)).toBe("2026-06-03");
    expect(addDays(-1)).toBe("2026-05-30");
  });
});

describe("pure formatters", () => {
  it("fmtDate renders a short month/day", () => {
    expect(fmtDate("2026-05-31")).toBe("May 31");
    expect(fmtDate("2026-01-01")).toBe("Jan 1");
  });

  it("dealSearchUrl builds a Google Shopping query, url-encoded", () => {
    const url = dealSearchUrl("oat milk", "H-E-B");
    expect(url.startsWith("https://www.google.com/search?tbm=shop&q=")).toBe(true);
    expect(url).toContain(encodeURIComponent("oat milk H-E-B"));
  });

  it("uid returns distinct non-empty ids", () => {
    const a = uid();
    const b = uid();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(4);
  });
});
