import type { StorageZone } from "./types";

/**
 * Typical storage times for common foods, condensed from the USDA FoodKeeper
 * guidance (foodsafety.gov). Ranges are for quality and safety under normal
 * home conditions; a printed use-by date and the package label win.
 */
export type DayRange = [number, number];
export interface ShelfLife {
  label: string;
  pantry?: DayRange;
  fridge?: DayRange;
  freezer?: DayRange;
  note?: string;
}

export const SHELF_LIFE_SOURCE = { name: "USDA FoodKeeper", url: "https://www.foodsafety.gov/keep-food-safe/foodkeeper-app" };

const week = (n: number) => n * 7;
const month = (n: number) => n * 30;

const RULES: Array<{ match: RegExp; life: ShelfLife }> = [
  { match: /\begg(s)?\b/, life: { label: "Eggs, in shell", fridge: [week(3), week(5)], note: "Keep in the carton on a shelf, not in the door. Do not freeze in the shell." } },
  { match: /\b(whole|skim|semi|oat|soy|almond)?\s*milk\b/, life: { label: "Milk, opened", fridge: [5, 7], freezer: [month(3), month(3)], note: "Plant milks follow their label; most keep 7–10 days after opening." } },
  { match: /\byog(h)?urt\b/, life: { label: "Yogurt", fridge: [week(1), week(2)], freezer: [month(1), month(2)] } },
  { match: /\b(cheddar|parmesan|gouda|gruy[eè]re|pecorino|hard cheese)\b/, life: { label: "Hard cheese, opened", fridge: [week(3), week(4)], freezer: [month(6), month(6)] } },
  { match: /\b(mozzarella|brie|feta|ricotta|paneer|cream cheese|soft cheese|halloumi)\b/, life: { label: "Soft cheese, opened", fridge: [7, 7], note: "Fresh cheeses in brine follow the date on the tub." } },
  { match: /\bbutter\b/, life: { label: "Butter", fridge: [month(1), month(3)], freezer: [month(6), month(9)] } },
  { match: /\bcream\b/, life: { label: "Cream, opened", fridge: [7, 10] } },
  { match: /\b(chicken|turkey|poultry)\b/, life: { label: "Raw poultry", fridge: [1, 2], freezer: [month(9), month(12)], note: "Cooked poultry keeps 3–4 days refrigerated." } },
  { match: /\b(ground|minced?)\s+(beef|pork|lamb|meat)\b|\bmince\b/, life: { label: "Ground meat", fridge: [1, 2], freezer: [month(3), month(4)] } },
  { match: /\b(beef|steak|lamb|pork|chop|roast)\b/, life: { label: "Fresh meat cuts", fridge: [3, 5], freezer: [month(4), month(12)] } },
  { match: /\bbacon\b/, life: { label: "Bacon, opened", fridge: [7, 7], freezer: [month(1), month(1)] } },
  { match: /\bsausage(s)?\b/, life: { label: "Raw sausages", fridge: [1, 2], freezer: [month(1), month(2)] } },
  { match: /\b(ham|deli|salami|prosciutto|cold cuts?)\b/, life: { label: "Deli meat, opened", fridge: [3, 5], freezer: [month(1), month(2)] } },
  { match: /\b(salmon|tuna|cod|tilapia|mackerel|trout|fish|fillet)\b/, life: { label: "Fresh fish", fridge: [1, 2], freezer: [month(2), month(6)], note: "Fatty fish keeps about 2–3 months frozen; lean fish up to 6." } },
  { match: /\b(shrimp|prawn|scallop|squid|crab|shellfish|mussel|clam)s?\b/, life: { label: "Raw shellfish", fridge: [1, 2], freezer: [month(3), month(6)] } },
  { match: /\btofu\b/, life: { label: "Tofu, opened", fridge: [3, 5], freezer: [month(3), month(5)], note: "Keep submerged in fresh water and change it daily." } },
  { match: /\btempeh\b/, life: { label: "Tempeh, opened", fridge: [5, 7], freezer: [month(3), month(6)] } },
  { match: /\b(cooked|leftover|leftovers|roasted|stew|curry|soup)\b/, life: { label: "Cooked leftovers", fridge: [3, 4], freezer: [month(2), month(3)], note: "Cool within two hours and reheat to 74°C / 165°F. Cooked rice: the UK FSA advises eating it within 24 hours." } },
  { match: /\bhummus\b/, life: { label: "Hummus, opened", fridge: [7, 7] } },
  { match: /\bkimchi\b|\bsauerkraut\b/, life: { label: "Fermented vegetables, opened", fridge: [month(1), month(3)] } },
  { match: /\bbread\b|\bbaguette\b|\bbuns?\b|\brolls?\b/, life: { label: "Bread", pantry: [5, 7], freezer: [month(3), month(3)], note: "Refrigerating bread goes stale faster; freeze slices instead." } },
  { match: /\btortilla(s)?\b|\bflatbread\b|\bpita\b|\bnaan\b/, life: { label: "Flatbreads", pantry: [7, 7], fridge: [week(3), week(4)], freezer: [month(3), month(3)] } },
  { match: /\bapple(s)?\b/, life: { label: "Apples", pantry: [week(3), week(3)], fridge: [week(4), week(6)] } },
  { match: /\bbanana(s)?\b|\bplantain(s)?\b/, life: { label: "Bananas and plantains", pantry: [3, 5], fridge: [2, 3], note: "Refrigerate only once ripe; the skin darkens but the fruit keeps." } },
  { match: /\b(strawberr|blueberr|raspberr|blackberr|berr)(y|ies)\b/, life: { label: "Berries", fridge: [3, 7], freezer: [month(8), month(12)], note: "Wash just before eating, not before storing." } },
  { match: /\b(lemon|lime|orange|grapefruit|clementine|mandarin|citrus)s?\b/, life: { label: "Citrus", pantry: [10, 10], fridge: [week(3), week(4)] } },
  { match: /\bavocado(s)?\b/, life: { label: "Avocado", pantry: [3, 5], fridge: [3, 5], note: "Ripen on the counter, then refrigerate." } },
  { match: /\bmango(es|s)?\b|\bpapaya\b|\bpineapple\b/, life: { label: "Tropical fruit", pantry: [3, 5], fridge: [5, 7] } },
  { match: /\bgrapes?\b/, life: { label: "Grapes", fridge: [7, 14] } },
  { match: /\btomato(es)?\b/, life: { label: "Tomatoes", pantry: [3, 5], fridge: [7, 7], note: "Ripen at room temperature; refrigerate once ripe." } },
  { match: /\b(spinach|lettuce|arugula|rocket|kale|chard|salad|greens|bok choy|pak choi|watercress)\b/, life: { label: "Leafy greens", fridge: [5, 7], note: "Store dry in a bag with a paper towel; wash before use." } },
  { match: /\b(basil)\b/, life: { label: "Basil", pantry: [3, 3], fridge: [3, 5], note: "Keep stems in water at room temperature; cold blackens the leaves." } },
  { match: /\b(cilantro|coriander|parsley|dill|mint|chives|thyme|rosemary|herbs?)\b/, life: { label: "Fresh herbs", fridge: [7, 10], freezer: [month(3), month(6)] } },
  { match: /\b(broccoli|cauliflower)\b/, life: { label: "Broccoli and cauliflower", fridge: [3, 5], freezer: [month(8), month(12)] } },
  { match: /\bcarrot(s)?\b|\bbeet(root)?s?\b|\bturnips?\b|\bparsnips?\b|\bradish(es)?\b/, life: { label: "Root vegetables", fridge: [week(2), week(3)] } },
  { match: /\bcabbage\b/, life: { label: "Cabbage", fridge: [week(1), week(2)] } },
  { match: /\b(bell|red|green|yellow)?\s*peppers?\b|\bcapsicum\b/, life: { label: "Peppers", fridge: [7, 14] } },
  { match: /\b(chilli|chili|chile)(es|s)?\b/, life: { label: "Fresh chillies", fridge: [7, 14], freezer: [month(6), month(6)] } },
  { match: /\bonion(s)?\b|\bshallots?\b/, life: { label: "Onions", pantry: [month(1), month(1)], fridge: [month(2), month(2)], note: "Cool, dry and dark, away from potatoes. Refrigerate once cut (7–10 days)." } },
  { match: /\b(spring onion|green onion|scallion)s?\b/, life: { label: "Spring onions", fridge: [7, 14] } },
  { match: /\bgarlic\b/, life: { label: "Garlic, whole bulbs", pantry: [month(3), month(5)], note: "Peeled or chopped cloves: refrigerate and use within a week." } },
  { match: /\bginger\b/, life: { label: "Fresh ginger", fridge: [week(3), week(3)], freezer: [month(6), month(6)] } },
  { match: /\bsweet potato(es)?\b|\byam(s)?\b/, life: { label: "Sweet potatoes", pantry: [week(2), week(4)], note: "Do not refrigerate raw." } },
  { match: /\bpotato(es)?\b/, life: { label: "Potatoes", pantry: [month(1), month(2)], note: "Cool, dark and ventilated. Refrigeration makes them sweet and grey when fried." } },
  { match: /\bmushroom(s)?\b/, life: { label: "Mushrooms", fridge: [4, 7], note: "Keep in a paper bag, not sealed plastic." } },
  { match: /\b(cucumber|zucchini|courgette|eggplant|aubergine|squash)s?\b/, life: { label: "Cucumbers and summer squash", fridge: [7, 7] } },
  { match: /\b(green beans|beans, green|snap peas|mangetout|asparagus)\b/, life: { label: "Fresh beans and asparagus", fridge: [3, 5] } },
  { match: /\bcorn\b|\bsweetcorn\b/, life: { label: "Corn on the cob", fridge: [1, 2] } },
  { match: /\bcelery\b/, life: { label: "Celery", fridge: [week(1), week(2)] } },
  { match: /\b(cooked|canned|tinned)\s+(beans|chickpeas|lentils|black-eyed peas)\b|\b(beans|chickpeas|lentils|black-eyed peas)\b.*\b(cooked|canned|tinned)\b/, life: { label: "Cooked or opened beans", fridge: [3, 5], freezer: [month(6), month(6)], note: "Move opened cans into a covered container." } },
  { match: /\b(dry|dried)?\s*(lentils|chickpeas|beans|split peas|black-eyed peas)\b/, life: { label: "Dry pulses", pantry: [month(12), month(12)], note: "Safe well beyond a year; older pulses take longer to soften." } },
  { match: /\bbrown rice\b/, life: { label: "Brown rice, dry", pantry: [month(6), month(6)], fridge: [month(12), month(12)] } },
  { match: /\brice\b/, life: { label: "White rice, dry", pantry: [month(24), month(24)], note: "Cooked rice: refrigerate within an hour and eat within a day." } },
  { match: /\b(pasta|spaghetti|penne|macaroni|noodles?)\b/, life: { label: "Dry pasta and noodles", pantry: [month(24), month(24)], note: "Fresh or cooked: refrigerate and use within 3–5 days." } },
  { match: /\b(oats|oatmeal|porridge)\b/, life: { label: "Oats", pantry: [month(12), month(12)] } },
  { match: /\b(quinoa|couscous|bulgur|barley|millet)\b/, life: { label: "Whole grains, dry", pantry: [month(12), month(12)] } },
  { match: /\bwhole\s*wheat\s*flour\b|\bwholemeal\b/, life: { label: "Whole-wheat flour", pantry: [month(3), month(3)], fridge: [month(6), month(6)], freezer: [month(12), month(12)] } },
  { match: /\bflour\b|\bcornstarch\b|\bcornflour\b/, life: { label: "White flour and starches", pantry: [month(6), month(8)] } },
  { match: /\b(almond|walnut|cashew|peanut|pecan|pistachio|hazelnut|nut)s?\b|\b(sesame|chia|flax|pumpkin|sunflower) seeds?\b/, life: { label: "Nuts and seeds", pantry: [month(4), month(4)], fridge: [month(6), month(6)], freezer: [month(12), month(12)], note: "Cold storage keeps the oils from going rancid." } },
  { match: /\bpeanut butter\b|\btahini\b|\bnut butter\b/, life: { label: "Nut butters, opened", pantry: [month(2), month(3)], fridge: [month(6), month(6)], note: "Natural nut butters keep better refrigerated." } },
  { match: /\bolive oil\b|\bvegetable oil\b|\bcoconut oil\b|\bsesame oil\b|\boil\b/, life: { label: "Cooking oil, opened", pantry: [month(6), month(12)], note: "Keep away from heat and light." } },
  { match: /\bsoy sauce\b|\btamari\b|\bfish sauce\b|\boyster sauce\b|\bhoisin\b|\bworcestershire\b/, life: { label: "Fermented sauces, opened", pantry: [month(12), month(12)], fridge: [month(12), month(24)], note: "Refrigeration keeps the flavour brighter." } },
  { match: /\b(curry paste|miso|gochujang|doenjang|sambal|harissa)\b/, life: { label: "Fermented pastes, opened", fridge: [month(3), month(12)] } },
  { match: /\bcoconut milk\b|\bcoconut cream\b/, life: { label: "Coconut milk", pantry: [month(24), month(60)], fridge: [4, 6], note: "Pantry range is unopened; refrigerate once opened." } },
  { match: /\btomato paste\b|\btomato pur[eé]e\b|\bpassata\b/, life: { label: "Tomato paste, opened", fridge: [5, 7], freezer: [month(2), month(3)], note: "Freeze in spoonfuls for later." } },
  { match: /\b(canned|tinned|can of)\b|\b(tomatoes|corn|tuna|sardines|chickpeas|beans)\s*\(?(can|tin)\)?\b/, life: { label: "Canned goods, unopened", pantry: [month(12), month(60)], note: "High-acid foods (tomatoes, fruit) keep 12–18 months; opened cans go in a covered container in the fridge for 3–4 days." } },
  { match: /\b(ketchup|mustard|mayonnaise|mayo|hot sauce|sriracha|salsa|relish)\b/, life: { label: "Condiments, opened", fridge: [month(2), month(6)] } },
  { match: /\bjam\b|\bjelly\b|\bmarmalade\b/, life: { label: "Jam, opened", fridge: [month(6), month(12)] } },
  { match: /\bhoney\b|\bmaple syrup\b|\bmolasses\b/, life: { label: "Honey and syrups", pantry: [month(24), month(36)], note: "Honey keeps indefinitely; refrigerate opened maple syrup." } },
  { match: /\bsugar\b|\bsalt\b/, life: { label: "Sugar and salt", pantry: [month(24), month(36)], note: "Keeps indefinitely when dry." } },
  { match: /\b(cumin|turmeric|paprika|curry powder|garam masala|cinnamon|coriander seed|chilli powder|chili powder|spice|spices|oregano|thyme, dried|dried herbs?)\b/, life: { label: "Ground spices and dried herbs", pantry: [month(24), month(36)], note: "Whole spices keep about twice as long." } },
  { match: /\bvinegar\b/, life: { label: "Vinegar", pantry: [month(24), month(36)] } },
  { match: /\b(coffee|tea)\b/, life: { label: "Coffee and tea", pantry: [month(6), month(12)] } },
  { match: /\b(frozen)\b.*\b(vegetable|veg|pea|spinach|corn|broccoli)s?\b|\b(vegetable|veg|pea|spinach|corn|broccoli)s?\b.*\bfrozen\b/, life: { label: "Frozen vegetables", freezer: [month(8), month(8)] } },
  { match: /\bfrozen\b.*\b(fruit|berr|mango)|\b(fruit|berr|mango).*\bfrozen\b/, life: { label: "Frozen fruit", freezer: [month(8), month(12)] } },
  { match: /\bice cream\b|\bgelato\b|\bsorbet\b/, life: { label: "Ice cream", freezer: [month(2), month(4)] } },
  { match: /\bfrozen\b/, life: { label: "Frozen food", freezer: [month(3), month(8)], note: "Follow the pack; cooked meals keep 2–3 months, raw meat longer." } },
  { match: /\bjuice\b/, life: { label: "Juice, opened", fridge: [7, 10] } },
  { match: /\bstock\b|\bbroth\b/, life: { label: "Stock, opened", fridge: [3, 4], freezer: [month(2), month(3)] } },
];

export function shelfLifeFor(name: string): ShelfLife | null {
  const lower = name.toLowerCase();
  return RULES.find(rule => rule.match.test(lower))?.life ?? null;
}

export function formatRange([min, max]: DayRange): string {
  const unit = (days: number) => days % 30 === 0 && days >= 30 ? { n: days / 30, label: "month" } : days % 7 === 0 && days >= 14 ? { n: days / 7, label: "week" } : { n: days, label: "day" };
  const a = unit(min); const b = unit(max);
  if (min === max) return `${a.n} ${a.label}${a.n === 1 ? "" : "s"}`;
  if (a.label === b.label) return `${a.n}–${b.n} ${b.label}s`;
  return `${a.n} ${a.label}${a.n === 1 ? "" : "s"} to ${b.n} ${b.label}${b.n === 1 ? "" : "s"}`;
}

/** The conservative end of the guidance for the zone, as an ISO date from `from`. */
export function suggestedExpiry(life: ShelfLife, zone: StorageZone, from = new Date()): string | undefined {
  const range = life[zone];
  if (!range) return undefined;
  const date = new Date(from);
  date.setDate(date.getDate() + range[0]);
  return date.toISOString().slice(0, 10);
}
