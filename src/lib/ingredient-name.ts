/** Narrow produce aliases only. Never collapse cooked/dry food or arbitrary final words. */
export function ingredientName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, ' ');
  const aliases: Record<string,string> = {
    'raw spinach':'spinach', 'raw cabbage':'cabbage', 'raw carrot':'carrot', 'raw broccoli':'broccoli',
    'raw tomato':'tomato', 'tomatoes':'tomato', 'carrots':'carrot', 'raw onion':'onion', 'onions':'onion',
    'raw garlic':'garlic', 'raw red bell pepper':'red bell pepper', 'raw banana':'banana', 'raw mango':'mango',
  };
  return aliases[normalized] ?? normalized;
}
