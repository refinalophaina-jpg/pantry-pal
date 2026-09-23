import { foodStorage } from "./food-storage";
import type { StorageZone, UnitType } from "./types";

/**
 * Turn a typed line like "2 kg rice, 6 eggs (fridge), spinach 200g" into
 * pantry items. Deterministic and forgiving; the household reviews the
 * preview before anything is saved.
 */
export interface QuickAddItem { name: string; quantity: number; unit: UnitType; zone: StorageZone; category: string }

const UNIT_ALIASES: Record<string, UnitType> = {
  g: "g", gram: "g", grams: "g", gr: "g", kg: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", millilitre: "ml", milliliter: "ml", l: "l", litre: "l", liter: "l", litres: "l", liters: "l",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  cup: "cup", cups: "cup", pcs: "pcs", pc: "pcs", piece: "pcs", pieces: "pcs", x: "pcs", pack: "pcs", packs: "pcs", can: "pcs", cans: "pcs", tin: "pcs", tins: "pcs", bunch: "pcs", bag: "pcs", bottle: "pcs", jar: "pcs", box: "pcs", dozen: "pcs",
};
const ZONES: StorageZone[] = ["pantry", "fridge", "freezer"];

const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/\b(milk|yog(h)?urt|cheese|cheddar|mozzarella|parmesan|feta|butter|cream|paneer)\b/, "Dairy"],
  [/\b(egg|eggs|chicken|beef|pork|lamb|turkey|fish|salmon|tuna|shrimp|prawn|tofu|tempeh|sausage|bacon|ham|mince|steak|lentil|lentils|chickpea|chickpeas|beans|black-eyed)\b/, "Protein"],
  [/\b(rice|pasta|spaghetti|noodle|noodles|bread|oats|quinoa|couscous|flour|tortilla|cereal|barley)\b/, "Grains"],
  [/\bfrozen\b|\bice cream\b/, "Frozen"],
  [/\b(oil|olive oil|ghee)\b/, "Oils"],
  [/\b(sauce|ketchup|mustard|mayo|mayonnaise|vinegar|soy|tamari|paste|miso|hoisin|sriracha|salsa|dressing|honey|jam|syrup)\b/, "Condiments"],
  [/\b(chips|crisps|crackers|cookies|biscuits|chocolate|nuts|almonds|popcorn|granola|bar|bars)\b/, "Snacks"],
  [/\b(juice|coffee|tea|water|soda|beer|wine|kombucha)\b/, "Beverages"],
  [/\b(salt|pepper|sugar|spice|cumin|turmeric|paprika|cinnamon|stock|broth|baking|yeast|vanilla|canned|tinned|can|tin)\b/, "Pantry staple"],
  [/\b(apple|banana|mango|berry|berries|lemon|lime|orange|grape|avocado|tomato|onion|garlic|ginger|potato|carrot|spinach|kale|lettuce|cabbage|broccoli|pepper|chilli|chili|cucumber|zucchini|mushroom|herb|basil|cilantro|coriander|parsley|celery|corn|beans|peas|plantain|papaya|pineapple|greens|squash|eggplant|aubergine)(?:es|s)?\b/, "Produce"],
];

export function guessCategory(name: string): string {
  const lower = name.toLowerCase();
  return CATEGORY_RULES.find(([pattern]) => pattern.test(lower))?.[1] ?? "Other";
}

export function guessZone(name: string, category = guessCategory(name)): StorageZone {
  const lower = name.toLowerCase();
  if (/\bfrozen\b|\bice cream\b/.test(lower)) return "freezer";
  if (/\b(onion|onions|garlic|potato|potatoes|sweet potato|banana|bananas|plantain|tomato|tomatoes|avocado|mango|mangoes|papaya|pineapple|squash|ginger)\b/.test(lower) && !/\b(cut|chopped|sliced|peeled)\b/.test(lower)) return "pantry";
  if (category === "Produce" || category === "Dairy" || category === "Protein") return /\b(dry|dried|canned|tinned|can|tin|lentils|chickpeas|beans)\b/.test(lower) && !/\bcooked\b/.test(lower) ? "pantry" : "fridge";
  return foodStorage(name).zone;
}

function parseQuantity(token: string): number | null {
  const fraction = token.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const value = Number(token.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseOne(raw: string): QuickAddItem | null {
  let text = raw.trim();
  if (!text) return null;
  let zone: StorageZone | undefined;
  text = text.replace(/\((pantry|fridge|freezer)\)|\b(?:in|to|→|->)\s+(?:the\s+)?(pantry|fridge|freezer)\b/gi, (_, a, b) => { zone = (a ?? b).toLowerCase() as StorageZone; return " "; });
  text = text.replace(/\s+/g, " ").trim();
  let quantity = 1;
  let unit: UnitType = "pcs";
  const qty = "((?:\\d+\\/\\d+)|(?:\\d+(?:[.,]\\d+)?))";
  const attempts: Array<[RegExp, (m: RegExpMatchArray) => [string, string | undefined, string]]> = [
    // "2 kg rice", "500g spinach", "1/2 cup oats"
    [new RegExp(`^${qty}\\s*([a-zA-Z]+)\\s+(.+)$`), (m) => [m[1], m[2], m[3]]],
    [new RegExp(`^${qty}([a-zA-Z]+)\\s*(.+)$`), (m) => [m[1], m[2], m[3]]],
    // "6 eggs", "3 tomatoes"
    [new RegExp(`^${qty}\\s+(.+)$`), (m) => [m[1], undefined, m[2]]],
    // "rice 2 kg", "spinach 200g", "eggs x6"
    [new RegExp(`^(.+?)\\s+(?:x\\s*)?${qty}\\s*([a-zA-Z]+)$`), (m) => [m[2], m[3], m[1]]],
    [new RegExp(`^(.+?)\\s+(?:x\\s*)?${qty}$`), (m) => [m[2], undefined, m[1]]],
  ];
  for (const [pattern, pick] of attempts) {
    const match = text.match(pattern);
    if (!match) continue;
    const [rawQuantity, rawUnit, rest] = pick(match);
    const parsed = parseQuantity(rawQuantity);
    if (parsed === null || (rawUnit && !UNIT_ALIASES[rawUnit.toLowerCase()])) continue;
    quantity = parsed;
    unit = rawUnit ? UNIT_ALIASES[rawUnit.toLowerCase()] : "pcs";
    text = rest;
    break;
  }
  const name = text.replace(/^(of|x)\s+/i, "").replace(/\s+/g, " ").trim();
  if (!name || name.length > 120) return null;
  const pretty = name.charAt(0).toUpperCase() + name.slice(1);
  const category = guessCategory(pretty);
  return { name: pretty, quantity: Math.round(quantity * 1000) / 1000, unit, zone: zone ?? guessZone(pretty, category), category };
}

export function parseQuickAdd(input: string): QuickAddItem[] {
  return input.split(/[\n;,]+/).map(parseOne).filter((item): item is QuickAddItem => item !== null).slice(0, 40);
}
