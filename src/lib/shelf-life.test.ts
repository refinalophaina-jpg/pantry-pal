import { describe, expect, it } from "vitest";
import { formatRange, shelfLifeFor, suggestedExpiry } from "./shelf-life";

describe("shelf-life guidance", () => {
  it("matches common foods by name and formats ranges in plain units", () => {
    expect(shelfLifeFor("Free-range eggs")?.label).toBe("Eggs, in shell");
    expect(shelfLifeFor("Chicken thighs")?.fridge).toEqual([1, 2]);
    expect(shelfLifeFor("Cooked lentils")?.label).toBe("Cooked or opened beans");
    expect(shelfLifeFor("Dry lentils")?.label).toBe("Dry pulses");
    expect(shelfLifeFor("Brown rice")?.label).toBe("Brown rice, dry");
    expect(shelfLifeFor("Basmati rice")?.label).toBe("White rice, dry");
    expect(shelfLifeFor("Frozen peas")?.freezer).toEqual([240, 240]);
    expect(shelfLifeFor("Mystery jar")).toBeNull();
    expect(formatRange([3, 5])).toBe("3–5 days");
    expect(formatRange([21, 35])).toBe("3–5 weeks");
    expect(formatRange([30, 90])).toBe("1–3 months");
    expect(formatRange([7, 7])).toBe("7 days");
  });
  it("suggests the conservative end of the range for the chosen zone only", () => {
    const life = shelfLifeFor("Spinach")!;
    expect(suggestedExpiry(life, "fridge", new Date("2026-09-23T12:00:00Z"))).toBe("2026-09-28");
    expect(suggestedExpiry(life, "freezer", new Date("2026-09-23T12:00:00Z"))).toBeUndefined();
  });
});
